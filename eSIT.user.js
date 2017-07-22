// ==UserScript==
// @name         eSIT: eSix Informative Thumbnails
// @namespace    prplbst
// @version      1.0.0
// @description  Gives each Video, Flash, and Blacklisted thumbnail on e621.net a unique appearance while also adding helpful info overlays to them.
// @author       purple.beastie
// @match        https://e621.net/*
// @match        https://e926.net/*
// @exclude      *.json
// @exclude      *.xml
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/jdenticon@1.6.0/dist/jdenticon.min.js
// ==/UserScript==

/*
 *  License Information
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function() {
    'use strict';

    var userPrefUseBinaryUnits = -1; // 0 for KiB, MiB, etc.; 1 for kB, MB, etc.; any other value for auto select
    var isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0,
        useBinaryUnits;
    switch (userPrefUseBinaryUnits) {
        case 0:
            useBinaryUnits = true;
            break;
        case 1:
            useBinaryUnits = false;
            break;
        default:
            useBinaryUnits = !isMac;
    }
    var iconSize = 114;
    var thumbCount = 0,
        thumbLimit = 1000, // maximum number of thumbs to process
        placeholderCount = 0,
        allPlaceholders = [];
    var propertiesToCopy = ["border-top-style",
                            "border-top-width",
                            "border-top-color",
                            "border-right-style",
                            "border-right-width",
                            "border-right-color",
                            "border-bottom-style",
                            "border-bottom-width",
                            "border-bottom-color",
                            "border-left-style",
                            "border-left-width",
                            "border-left-color",
                            "border-top-left-radius",
                            "border-top-right-radius",
                            "border-bottom-left-radius",
                            "border-bottom-right-radius",
                            "box-shadow"];

    var css = [
        '.esit-container {display:block;position:relative;z-index:5;width:150px;height:150px;overflow:hidden;margin:0 auto;vertical-align:middle;}',
        '.thumb .esit-container {display:block}',
        '.thumb_dtext .esit-container, .thumb_avatar .esit-container {display: inline-block}',
        '.thumb_avatar .esit-container {margin-bottom:3px}',
        '.esit-btn {width:100%;height:100%;border:0;padding:0;background:none;cursor:pointer;background:#000}',

        '.esit-label-blacklist ~ .esit-label {opacity:0}',
        '.esit-container:hover .esit-blacklist-items {opacity:1}',
        '.esit-container:hover .esit-label {opacity:0}',
        '.esit-container:hover .esit-label-blacklist ~ .esit-label {opacity:1}',
        '.esit-container:focus-within .esit-blacklist-items {opacity:1}',
        '.esit-container:focus-within .esit-label {opacity: 0}',
        '.esit-container:focus-within .esit-label-blacklist ~ .esit-label {opacity: 1}',
        '.esit-btn:focus .esit-blacklist-items {opacity:1}', // fallback because focus-within is not well supported yet
        '.esit-btn:focus .esit-label {opacity:0}', // fallback
        '.esit-btn:focus .esit-label-blacklist ~ .esit-label {opacity:1}', // fallback

        '.esit-container img.esit-img {position:static;display: inline;padding:' + (150 - iconSize) / 2 + 'px;}',
        '.esit-placeholder {position:absolute;z-index:10;top:0;left:0;padding:0;pointer-events:none}',

        // Text
        '.esit-text {color:white;transition: opacity 0.3s ease;width: 100%; height: 100%;z-index: 1;display:flex;justify-content:center;align-items:center;position:absolute;top:0;}',
        '.esit-label {transition:opacity 0.35s ease 0.08s;position:relative;font-size: 20px;font-weight: bold;letter-spacing:0.5px;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;}',
        '.esit-file-size {position: absolute;bottom:2px;left:4px;}',
        '.esit-dimensions {position: absolute;bottom:2px;right:4px;}',

        // Outer text stroke workaround for labels
        '.esit-label::before {position:absolute;-webkit-text-stroke: 4px #000;text-stroke: 4px #000;left:0;z-index:-1;}',
        '.esit-label-blacklist::before {content:"Blacklisted";}',
        '.esit-label-video::before {content:"Video";}',
        '.esit-label-flash::before {content:"Flash";}',
        '.esit-label-deleted::before {content:"Deleted";}',

        // Blacklist overlay
        '.esit-blacklist-items {opacity:0;transition: opacity 0.35s ease 0.18s;width: 140px; height: 140px;position: absolute;top:0;left:0;background: rgba(0,0,0,0.8);z-index:1;text-align:left;padding:5px;}',
        '.esit-blacklist-items p {color:white;font-size:11px;overflow:hidden;}',
        '.esit-bl-tag {white-space: nowrap;}',

        // Blacklist link
        '.esit-blacklist-link {width:100%;height:30px;position:absolute;bottom:0;left:0;z-index:2;background:#333;display:flex;justify-content:center;align-items:center;font-size:15px;transition:opacity 0.35s ease 0.2s,background-color 0.3s ease;opacity:0;border-top-left-radius:inherit;border-top-right-radius:inherit;}',
        'a:link .esit-blacklist-link, a:visited .esit-blacklist-link, a:focus .esit-blacklist-link {color:white}',
        'a:focus .esit-blacklist-link:not(:active):hover {text-decoration:underline}',
        '.esit-blacklist-link:hover, a:focus .esit-blacklist-link {opacity:1}',
        '.esit-blacklist-link:active {background:#555;}',

        '.esit-preview-bg {background:hsla(0,0%,100%,0.12) !important}',
        '.esit-preview-border {width: 100%;height: 100%;box-sizing: border-box;border: 2px #600 solid;position: absolute;z-index:3;left: 0;top: 0;border-radius: inherit;pointer-events:none;}',

        '.esit-fader {transition: opacity 0.7s ease}',
        '.esit-fade {opacity: 0}',
        '.esit-hide {display:none !important;}',
        'span.esit-container>button.esit-btn>img.esit-img-reset {' + propertiesToCopy.join(":initial !important;") + ':initial !important;}',

        // Adjust main CSS
        'div#recent-user {min-width: 338px;width:338px;}',
        '#userpage .thumbs-user:last-child {margin-left:0}',
        '#userpage div.userpage_right {margin-left: 172px}',
        '.thumbs-user.section, #userpage .thumb {width: 156px;}',
        '#userpage .thumb_avatar :not(.esit-container) img {margin-bottom:3px}',
        '#userpage .level-blocked {padding-left: 5px; padding-right: 5px;}'
    ].join("\n");

    var style = document.createElement("style");
    style.type = 'text/css';
    style.id = 'esit-informative-thumb-stylesheet';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    function formatBytes(nBytes, binaryUnits) {
        var units,
            oneKay;
        if (binaryUnits) {
            units = ["B", "KiB", "MiB", "GiB"];
            oneKay = 1024;
        } else {
            units = ["B", "kB", "MB", "GB"];
            oneKay = 1000;
        }
        var magnitude = Math.floor(Math.log(nBytes) / Math.log(oneKay)),
            decimals = Math.max(magnitude - 1, 0);
        return parseFloat((nBytes / Math.pow(oneKay, magnitude)).toFixed(decimals)) + units[magnitude]; // TB+ files will break this. Oh no!
    }

    function timer(lap){
        if(lap) console.log(lap, 'in:', (performance.now()-timer.prev).toFixed(3) + 'ms');
        timer.prev = performance.now();
    }

    // public domain toBlob polyfill
    if (!HTMLCanvasElement.prototype.toBlob) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            value: function (callback, type, quality) {

                var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
                    len = binStr.length,
                    arr = new Uint8Array(len);

                for (var i = 0; i < len; i++ ) {
                    arr[i] = binStr.charCodeAt(i);
                }

                callback( new Blob( [arr], {type: type || 'image/png'} ) );
            }
        });
    }

    function createInfoThumb(pair) {
        if (thumbCount > thumbLimit)
            throw $break;
        var thumbs = $$("#p" + pair.key);
        if (thumbs.length === 0)
            return;
        var post = pair.value;

        // generate identicon (or black fill for deleted posts)
        var icon = document.createElement("canvas"),
            ctx = icon.getContext('2d');
        icon.width = icon.height = iconSize;
        if (post.md5) {
            jdenticon.drawIcon(ctx, post.md5, iconSize);
        } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, icon.width, icon.height);
        }
        var needsTypeThumb = post.file_ext === 'webm' || post.file_ext === 'swf' || post.status === 'deleted',
            needsBlacklistThumb = Post.blacklist_options.replace && post.blacklisted.length > 0;
        thumbs.each(function(thumb) {
            if (thumbCount > thumbLimit)
                throw $break;
            if (needsTypeThumb || needsBlacklistThumb) {
                thumbCount++;
                var esitContainer = document.createElement("span"),
                    esitButton = document.createElement("button"),
                    esitText = document.createElement("div");
                esitContainer.className = 'esit-container';
                esitButton.className = 'esit-btn';
                esitText.className = 'esit-text';

                esitContainer.appendChild(esitButton);
                esitButton.appendChild(esitText);

                var anchor = thumb.down('a'),
                    score = thumb.down('.post-score'),
                    originalImg = anchor.down('img'),
                    img = originalImg.cloneNode(false),
                    imgStyle = window.getComputedStyle(originalImg, null);

                if (score) {
                    score.style.setProperty('font-size', '100%');
                    var scoreWidth = 150,
                        blw = parseFloat(imgStyle.getPropertyValue('border-left-width')),
                        brw = parseFloat(imgStyle.getPropertyValue('border-right-width'));
                    scoreWidth += blw + brw;
                    score.style.setProperty('width', scoreWidth + 'px');
                }

                // copy certain properties from the img
                for (var pi=0; pi < propertiesToCopy.length; pi++) {
                    var property = propertiesToCopy[pi],
                        propertyValue = imgStyle.getPropertyValue(property);
                    esitContainer.style.setProperty(property, propertyValue);
                }
                // now safe to reset those properties on the img
                img.className ='esit-img esit-img-reset';

                var isVisible = thumb.offsetWidth > 0 || thumb.offsetHeight > 0;
                if (isVisible) {
                    esitText.classList.add('esit-fade');
                    var placeholder = img.cloneNode(false);
                    placeholderCount++;
                    esitContainer.appendChild(placeholder);
                    placeholder.className = 'esit-placeholder esit-fader';
                    placeholder.addEventListener("transitionend", function (event) {
                        event.currentTarget.parentNode.removeChild(placeholder);
                        esitText.classList.remove('esit-fade');
                    });
                }
                anchor.replaceChild(esitContainer, originalImg);

                img.width = img.height = iconSize;

                icon.toBlob(function(blob) {
                    var url = URL.createObjectURL(blob);
                    img.addEventListener("load", function() {
                        // Because Firefox fires a load event twice per img, fade transition occurs before the thumbnails are ready
                        URL.revokeObjectURL(url);
                        if (placeholder) {
                            allPlaceholders.push(placeholder);
                            if (allPlaceholders.length === placeholderCount) {
                                for (var t=0; t < placeholderCount; t++) {
                                    allPlaceholders[t].classList.add('esit-fade');
                                }
                            }
                        }
                    });
                    img.src = url;
                });

                if (needsTypeThumb) {
                    var typeLabel = document.createElement("span");
                    typeLabel.className = 'esit-label';
                    esitText.appendChild(typeLabel);
                    esitText.title = img.title;

                    if (post.status === 'deleted') {
                        if (needsBlacklistThumb) typeLabel.classList.toggle('esit-hide');
                        typeLabel.innerHTML = 'Deleted';
                        typeLabel.classList.add('esit-label-deleted');
                    } else {
                        var postFileSize = document.createElement("span"),
                            postDimensions = document.createElement("span");

                        postFileSize.className = 'esit-file-size';
                        postDimensions.className = 'esit-dimensions';

                        if (needsBlacklistThumb) {
                            typeLabel.classList.add('esit-hide');
                            postFileSize.classList.add('esit-hide');
                            postDimensions.classList.add('esit-hide');
                        }

                        esitText.appendChild(postFileSize);
                        esitText.appendChild(postDimensions);
                        postFileSize.innerHTML = formatBytes(post.file_size, useBinaryUnits);
                        postDimensions.innerHTML = post.width + "x" + post.height;
                        switch (post.file_ext) {
                            case 'swf':
                                typeLabel.innerHTML = 'Flash';
                                typeLabel.classList.add('esit-label-flash');
                                break;
                            default:
                                typeLabel.innerHTML = 'Video';
                                typeLabel.classList.add('esit-label-video');
                        }
                    }
                }

                if (needsBlacklistThumb) {
                    var link = document.createElement("span");
                    link.innerHTML = 'Link';
                    link.classList.add('esit-blacklist-link');
                    esitContainer.appendChild(link);
                    link.title = img.title;
                    var ignoreLeftClick = function(e) {
                        if (e.button === 0) {
                            e.preventDefault();
                            anchor.blur();
                            esitButton.click();
                        }
                    };
                    link.addEventListener("mouseover", function() {
                        link.addEventListener("click", ignoreLeftClick);
                        setTimeout(function(){link.removeEventListener("click", ignoreLeftClick);}, 300);
                    });

                    var previewBorder = document.createElement("span");
                    previewBorder.className = 'esit-preview-border esit-hide';
                    var containerStyle = window.getComputedStyle(esitContainer, null),
                        noBTS = containerStyle.getPropertyValue('border-top-style') === 'none',
                        noBBS = containerStyle.getPropertyValue('border-bottom-style') === 'none',
                        topR = noBTS ? 'inherit' : '0',
                        bottomR = noBBS ? 'inherit' : '0';
                    previewBorder.style.setProperty('border-radius', [topR, topR, bottomR, bottomR].join(' '));
                    esitContainer.appendChild(previewBorder);

                    var blacklistLabel = document.createElement("span");
                    blacklistLabel.className = 'esit-label esit-label-blacklist';
                    blacklistLabel.innerHTML = 'Blacklisted';
                    esitText.insertAdjacentElement('afterbegin', blacklistLabel);

                    var blacklistedFor = document.createElement("div");
                    blacklistedFor.className = 'esit-blacklist-items';
                    for (var i=0; i < post.blacklisted.length; i++) {
                        var blItem = document.createElement("p");
                        blItem.innerHTML = "<span class='esit-bl-tag'>" + post.blacklisted[i].tags.join("</span> <span class='esit-bl-tag'>") + "</span>";
                        blacklistedFor.appendChild(blItem);
                    }
                    esitText.removeAttribute("title");

                    blacklistLabel.insertAdjacentElement('afterend', blacklistedFor);
                    esitButton.addEventListener("click", function (event) {
                        if (event.button === 0) {
                            event.preventDefault();
                            thumbs.each(function(thumb) {
                                var thumbButton = thumb.down('.esit-btn');
                                if (!thumbButton)
                                    return;
                                var img = thumb.down('img.esit-img'),
                                    toToggle = thumb.querySelectorAll('.esit-label, .esit-file-size, .esit-dimensions, .esit-blacklist-items, .esit-preview-border');
                                if (!needsTypeThumb) {
                                    var preview = thumb.down('.esit-preview');
                                    if (!preview) {
                                        preview = document.createElement("img");
                                        preview.width = post.preview_width;
                                        preview.height = post.preview_height;
                                        preview.src = post.preview_url;
                                        preview.alt = "";
                                        preview.className = 'esit-preview esit-hide';
                                        var thumbText = thumb.down('.esit-text');
                                        thumbButton.insertBefore(preview, thumbText);
                                    }
                                    var swap = img.alt;
                                    img.alt = preview.alt;
                                    preview.alt = swap;
                                    img.classList.toggle('esit-hide');
                                    preview.classList.toggle('esit-hide');
                                    thumbButton.classList.toggle('esit-preview-bg');
                                }
                                esitText.title = esitText.title ? "" : link.title;
                                for (var i=0; i < toToggle.length; i++) {
                                    toToggle[i].classList.toggle('esit-hide');
                                }
                            });
                        }
                    });
                    esitButton.addEventListener("mouseup", function (event) {
                        event.currentTarget.blur();
                    });
                }
                esitButton.appendChild(img);
            }
        });
    }
    //timer();
    Post.posts.each(createInfoThumb);
    //timer('All thumbs processed');
})();
