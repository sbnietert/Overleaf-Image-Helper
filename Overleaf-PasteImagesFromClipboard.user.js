// ==UserScript==
// @name         Overleaf - Paste Images from Clipboard
// @namespace    http://sebastianhaas.de
// @version      0.5
// @description  Paste images from your clipboard directly into Overleaf (Community Edition, Cloud and Pro)
// @author       Sebastian Haas
// @match        https://www.overleaf.com/project/*
// @match        http://192.168.100.239/project/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.js
// @grant        none
// ==/UserScript==

// MODIFIED BY SLOAN NIETERT - "assets" folder now only created upon pasting image for first time

// Parse images from the clipboard
function retrieveImageFromClipboardAsBlob(pasteEvent, callback){
    if(pasteEvent.clipboardData == false){
        if(typeof(callback) == "function"){
            callback(undefined);
        }
    };

    var items = pasteEvent.clipboardData.items;

    if(items == undefined){
        if(typeof(callback) == "function"){
            callback(undefined);
        }
    };

    for (var i = 0; i < items.length; i++) {
        // Skip content if not image
        if (items[i].type.indexOf("image") == -1) continue;
        // Retrieve image on clipboard as blob
        var blob = items[i].getAsFile();

        if(typeof(callback) == "function"){
            callback(blob);
        }
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assetsFolderExists = () => _ide.fileTreeManager.findEntityByPath("assets") != null;

async function waitForAssetsFolder(initialTimeout, increment) {
    if (assetsFolderExists()) return;
    _ide.fileTreeManager.createFolder("assets","/");

    let timeout = initialTimeout;
    while(true) {
        console.log("Assets folder not yet created...")
        await delay(timeout);
        timeout += increment;
        if(assetsFolderExists()) return;
    }
}

// Upload the image blob
async function uploadImage(imageBlob,hash){
    try{
        await waitForAssetsFolder(100,200);
        var xhr = new XMLHttpRequest();
        var url = document.location.pathname + "/upload?folder_id=" + _ide.fileTreeManager.findEntityByPath("assets").id + "&_csrf=" + csrfToken;
        let formData = new FormData();
        formData.append("qqfile", imageBlob, hash + ".png");
        xhr.open("POST", url, true);
        //xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var json = JSON.parse(xhr.responseText);
                console.log(json.entity_id + " Asset created :)");
            }
        };
        xhr.send(formData);
    }catch(e)
    {
        console.log(e)
    }
};

// Listen for paste events
document.querySelector('.ace_editor').addEventListener('paste', function(e){
    try {
        // Handle the event
        retrieveImageFromClipboardAsBlob(e, function(imageBlob){
            // Image?
            if(imageBlob){
                var reader = new FileReader();
                reader.readAsBinaryString(imageBlob);
                reader.onloadend = async function () {
                    var hash = CryptoJS.MD5(reader.result).toString().substring(0,8);
                    console.log("Uploading image...");
                    await uploadImage(imageBlob,hash);
                    _ide.editorManager.$scope.editor.sharejs_doc.ace.insert("\\begin{figure}[h!]\n\
\t\\centering\n\
\t\\includegraphics[width=0.66\\textwidth]{assets/" + hash + ".png}\n\
\t\\caption{Caption}\n\
\\end{figure}"
                                                                           );
                    _ide.editorManager.$scope.editor.sharejs_doc.ace.selection.moveCursorBy(-1,1);
                    _ide.editorManager.$scope.editor.sharejs_doc.ace.selection.selectWordRight()
                };
            }
        })
    } catch (e) {
        console.log(e);
    }}
);
