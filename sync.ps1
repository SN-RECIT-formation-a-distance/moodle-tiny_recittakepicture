$from = "moodle-tiny_recittakepicture/src/*"
$to = "shared/recitfad3/lib/editor/tiny/plugins/recittakepicture"
$source = "./src";

try {
    . ("..\sync\watcher.ps1")
}
catch {
    Write-Host "Error while loading sync.ps1 script." 
}