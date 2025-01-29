// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 *
 * @module      tiny_recittakepicture/plugin
 * @copyright  2019 RECIT
 * @license    {@link http://www.gnu.org/licenses/gpl-3.0.html} GNU GPL v3 or later
 */
///import {get_string as getString} from 'core/str';
import {getFilePicker} from 'editor_tiny/options';

export class Editor {


       COMPONENTNAME= 'tiny_recittakepicture'
       stream= null

       accessGranted= true
       streamOptions= {video: { width: { min: 64, ideal: 1920 }, height: { min: 40, ideal: 1080 }}}
       devices= []
       cur_devices= 0
       shotBlob= ''
       cropper= null
       dialogue = null

    open(editor){
        this.editor = editor;
        
                
        if (navigator.permissions){
            navigator.permissions.query({name: "camera"}).then(function(state){ 
                if (state == 'prompt') this.accessGranted = false; 
            });
        }
        
        var src = M.cfg.wwwroot +'/lib/editor/tiny/plugins/recittakepicture/js/cropper.js';
        var that = this;
        requirejs([src], function(app) {
            that.cropper = app;
        });
        if (!this.accessGranted){
            alert(M.util.get_string('grantaccess', this.COMPONENTNAME));
            navigator.mediaDevices.getUserMedia({video:true});
            return;
        }
        
        var content = '' +
            '<form id="atto_recittakepicture_dialogue" class="recittakepicture">' +
                '<div class="camera" id="'+this.COMPONENTNAME+'camera"><div style="margin:auto">' +
                    '<button id="'+this.COMPONENTNAME+'close" class="closebtn"><i class="fa fa-times-circle"></i></button>' +
                    '<video id="'+this.COMPONENTNAME+'video" autoplay playsinline></video>' +
                    '<div class="livevideo-controls"><div class="video-options"><button class="btn btn-secondary"><i class="fa fa-repeat"></i></button>' +
                    '<div class="container-circles" id="'+this.COMPONENTNAME+'startbutton"><div class="outer-circle"><div class="inner-circle"></div></div></div></div></div>' +
                '</div></div>' +
                '<canvas id="'+this.COMPONENTNAME+'canvas" style="display:none"></canvas>' +
                '<div class="camoutput">' +
                    '<div class="preview"></div>' +
                    '<img id="'+this.COMPONENTNAME+'photo" width="'+( window.innerWidth * 0.8)+'" height="'+( window.innerHeight * 0.8)+'" alt="capture">' +
                    '<div class="video-controls"><button id="'+this.COMPONENTNAME+'returnbutton" class="btn btn-secondary">'+M.util.get_string('back', this.COMPONENTNAME)+'</button>' +
                    '<button class="btn btn-primary" id="'+this.COMPONENTNAME+'submit" disabled> '+M.util.get_string('saveimage', this.COMPONENTNAME)+'</button></div>' +
                '</div>' +
            '</form>';
        this.dialogue = this.createPopup(content);
        
        // Apple bug: hide Safari navbar so users can see buttons
        if (navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPad/i)) {
            /* iOS hides Safari address bar */
            window.scrollTo(0, 1);
        }

        var camera = document.getElementById(this.COMPONENTNAME+'camera');
        var video = document.getElementById(this.COMPONENTNAME+'video');
        var canvas = document.getElementById(this.COMPONENTNAME+'canvas');
        var photo = document.getElementById(this.COMPONENTNAME+'photo');
        var closebutton = document.getElementById(this.COMPONENTNAME+'close');
        var startbutton = document.getElementById(this.COMPONENTNAME+'startbutton');
        var returnbutton = document.getElementById(this.COMPONENTNAME+'returnbutton');
        var submitbutton = document.getElementById(this.COMPONENTNAME+'submit');
        var photodata = '';
        var that = this;

        //Generate white preview
        var context = canvas.getContext('2d');
        context.fillStyle = "#AAA";
        context.fillRect(0, 0, canvas.width, canvas.height);

        photodata = canvas.toDataURL('image/png');
        photo.setAttribute('src', photodata);

        this.startStream();
        photo.parentElement.style.display = "none";

        startbutton.addEventListener('click', function(ev) {
            ev.preventDefault();
            if (camera.style.display === "none") {
                camera.style.display = "block";
                photo.parentElement.style.display = "none";
                submitbutton.disabled = true;
                return;
            }else{
                camera.style.display = "none";
                photo.parentElement.style.display = "block";
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            if (typeof ImageCapture !== 'undefined'){
                const mediaStreamTrack = video.srcObject.getVideoTracks()[0];
                const imageCapture = new ImageCapture(mediaStreamTrack);
                imageCapture.grabFrame().then(function(img){
                    that.bmpToBlob(img, function(blob){
                        that.shotBlob = blob;
                    })
                });
            }
    
            photodata = canvas.toDataURL('image/png');
            if (that.shotBlob){
                photodata = URL.createObjectURL(that.shotBlob);
            }
            photo.setAttribute('src', photodata);

            that.initCropper();
            
            submitbutton.disabled = false;
        }, false);
        
        returnbutton.addEventListener('click', function(ev) {
            ev.preventDefault();
            camera.style.display = "block";
            photo.parentElement.style.display = "none";
            submitbutton.disabled = true;
            if (that.cropperEl) that.cropperEl.destroy();
            that.shotBlob = null;
            that.cropperEl = null;
        });
        
        closebutton.addEventListener('click', function(ev) {
            ev.preventDefault();
            that.close();
        });

        submitbutton.addEventListener('click', function(ev) {
            ev.preventDefault();
            
            // Disable buttons as the process can be slow on old devices
            submitbutton.disabled = true;
            submitbutton.innerHTML = '<i class=\'fa fa-spinner fa-spin\'></i>';
            returnbutton.disabled = true;

            setTimeout(function(){
                // Convert it to a blob to upload
                var canvas = that.cropperEl.getCroppedCanvas({
                    maxHeight: 2000
                });
                var blob = canvas.toDataURL('image/jpeg', 1.0);
                blob = that._convertImage(blob);
                
                that._uploadImage(blob);
            }, 500);
        }, false);
        this.loadCameraDevices();
        this.initChangeDevice();
    }
    
    createPopup(content) {
        let modal = document.createElement('div');
        modal.classList.add('modal', 'fade', 'recittakepicture_popup');
        modal.setAttribute('style', 'overflow-y: hidden;');

        let inner2 = document.createElement('div');
        inner2.classList.add('modal-dialog');
        inner2.classList.add('modal-xl');
        modal.appendChild(inner2);

        let inner = document.createElement('div');
        inner.classList.add('modal-content');
        inner2.appendChild(inner);

        let header = document.createElement('div');
        header.classList.add('modal-header');
        header.innerHTML = "<h2>"+M.util.get_string('pluginname', 'tiny_recittakepicture')+"</h2>";
        inner.appendChild(header);

        let btn = document.createElement('button');
        btn.classList.add('close');
        btn.innerHTML = '<span aria-hidden="true">&times;</span>';
        btn.setAttribute('data-dismiss', 'modal');
        btn.onclick = this.destroy.bind(this);
        header.appendChild(btn);

        let body = document.createElement('div');
        body.classList.add('modal-body');
        inner.appendChild(body);
        body.innerHTML = content;

        document.body.appendChild(modal);
        this.popup = modal;

        this.popup.classList.add('show');

        this.backdrop = document.createElement('div');
        this.backdrop.classList.add('modal-backdrop', 'fade', 'show');
        this.backdrop.setAttribute('data-backdrop', 'static');
        document.body.appendChild(this.backdrop);
    }

    destroy(){
        this.popup.classList.remove('show');
        this.backdrop.classList.remove('show');
        this.popup.remove();
        this.backdrop.remove();

        if(this.appReact){
            this.appReact.unmount();
        }
    }


    initCropper(){
        if (this.cropperEl) this.cropperEl.destroy();
        
        var photo = document.getElementById(this.COMPONENTNAME+'photo');

        this.cropperEl = new this.cropper(photo, {
        aspectRatio: 0,
        viewMode: 0,
        preview: '.preview'
        });
    }

    loadCameraDevices(){
        if ('mediaDevices' in navigator && navigator.mediaDevices.getUserMedia) {
            var that = this;
            navigator.mediaDevices.enumerateDevices().then(function(devices){
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                if (videoDevices.length == 0){
                    document.querySelector('.video-options').style.display = 'none';
                }
                that.devices = [];
                for (var dev of videoDevices){
                    that.devices.push(dev.deviceId);
                }
            });
        }else{
            // Hide camera switch button if they have only one camera
            document.querySelector('.video-options').style.display = 'none';
        }
    }

    initChangeDevice(){
        var that = this;
        var btn = document.querySelector('.video-options>button');
        btn.addEventListener('click', function(ev){
            ev.preventDefault();
            if (that.devices.length == that.cur_devices){
                that.cur_devices = 0;
            }
            var dev = that.devices[that.cur_devices];
            that.streamOptions.video.deviceId = {exact:dev};
            that.cur_devices++;
            that.startStream();
        });

        window.addEventListener("orientationchange", function(event) {
            if (!that.cropperEl) return;
            that.initCropper();
        });
    }

    startStream(){
        // access video stream from webcam
        var video = document.getElementById(this.COMPONENTNAME+'video');
        var that = this;
        that.stopStream();
        
        if(navigator && navigator.mediaDevices){
            navigator.mediaDevices.getUserMedia(that.streamOptions)
            // on success, stream it in video tag
            .then(function(stream) {
                video.srcObject = stream;
                that.stream = stream;
                video.play();
                that.loadCameraDevices();
            })
            .catch(function(err) {
                alert(M.util.get_string('error', this.COMPONENTNAME)+": " + err);
            });
        }
        else{
            alert(M.util.get_string('error', this.COMPONENTNAME));
            console.log("navigator or navigator.mediaDevices are undefined");
        }
    }

    stopStream(){
        if (this.stream){
            this.stream.getTracks().forEach(function(t){ t.stop()});
        }
    }

    _convertImage(dataURI) {
        // convert base64/URLEncoded data component to raw binary data held in a string
        var byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0) {
            byteString = atob(dataURI.split(',')[1]);
        } else {
            byteString = decodeURI(dataURI.split(',')[1]);
        }
        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

        // write the bytes of the string to a typed array
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        return new Blob([ia], {type: mimeString});
    }

    getFileTransferData(){
        const options = getFilePicker(this.editor, 'media');

        var result = {};
        result.repo_id = 0 || 0;
        result.client_id = options.client_id || 0;
        result.env = options.env || '';
        result.license = options.defaultlicense || '';
        result.itemid = options.itemid || 0;
        result.author = options.author || '';

        var attr = '';
        for(attr in options.repositories){
            if (options.repositories[attr].type === 'upload') {
                result.repo_id = options.repositories[attr].id;
                break;
            }
        }

        for(attr in options.licenses){
            if (options.licenses[attr].shortname === 'cc') { // creative commons
                result.license = options.licenses[attr].shortname;
                break;
            }
        }

        return result;
    }

    _uploadImage(fileToSave) {

        var self = this;

        var options = this.getFileTransferData(),
            savepath = (options.savepath === undefined) ? '/' : options.savepath,
            formData = new FormData(),
            timestamp = 0,
            uploadid = "",
            xhr = new XMLHttpRequest();

        formData.append('repo_upload_file', fileToSave);
        formData.append('itemid', options.itemid);

        formData.append('repo_id', options.repo_id);
        formData.append('env', options.env);
        formData.append('sesskey', M.cfg.sesskey);
        formData.append('client_id', options.client_id);
        formData.append('savepath', savepath);

        // Kick off a XMLHttpRequest.
        xhr.onreadystatechange = function() {
            var result,
                file,
                newhtml;

            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    result = JSON.parse(xhr.responseText);
                    if (result) {
                        if (result.error) 
                            throw new M.core.ajaxException(result);
                        }

                        file = result;
                        if (result.event && result.event === 'fileexists') {
                            // A file with this name is already in use here - rename to avoid conflict.
                            // Chances are, it's a different image (stored in a different folder on the user's computer).
                            // If the user wants to reuse an existing image, they can copy/paste it within the editor.
                            file = result.newfile;
                        }

                        // Replace placeholder with actual image.
                        newhtml = '<img class="w-100" src="'+file.url+'"/>';
                        self.editor.execCommand('mceInsertContent', false, newhtml);
                        self.destroy();
                    }
                } else {
                     //alert(M.util.get_string('servererror', 'moodle'));
                }
            
        }

        xhr.open("POST", M.cfg.wwwroot + '/repository/repository_ajax.php?action=upload', true);
        xhr.send(formData);
    }

    close(){
        this.getDialogue({
            focusAfterHide: null
        }).hide();
        this.stopStream();
        if (this.cropperEl) this.cropperEl.destroy();
        this.shotBlob = null;
        this.cropperEl = null;
    }
    
    bmpToBlob(img, f){
      const canvas = document.createElement('canvas');
      // resize it to the size of our ImageBitmap
      canvas.width = img.width;
      canvas.height = img.height;
      // try to get a bitmaprenderer context
      let ctx = canvas.getContext('bitmaprenderer');
      if(ctx) {
        // transfer the ImageBitmap to it
        ctx.transferFromImageBitmap(img);
      }
      else {
        // in case someone supports createImageBitmap only
        // twice in memory...
        canvas.getContext('2d').drawImage(img,0,0);
      }
      // get it back as a Blob
      var blob = canvas.toBlob(f);
      canvas.remove()
      return blob;
    }
}