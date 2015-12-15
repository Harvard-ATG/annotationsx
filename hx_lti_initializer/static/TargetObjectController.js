/***
 * TargetObjectController.js
 *
 ***/

(function($) {
    $.TargetObjectController = function(options, commonInfo) {
        this.initOptions = jQuery.extend({}, options, commonInfo);
        this.init();
    };

    /* init
     * 
     */
    $.TargetObjectController.prototype.init = function(){

        if (this.initOptions.mediaType == "text") {
                this.setUpTargetAsText(this.initOptions.annotationElement, this.initOptions.object_id);
        } else if (this.initOptions.mediaType == "image") {
                this.setUpTargetAsImage(this.initOptions.annotationElement, this.initOptions.object_id);
        }
    
    };

    $.TargetObjectController.prototype.setUpTargetAsText = function(element, targetObject) {
        
        var self = this;

        // Shows annotation toggle label only when hovered
        jQuery('.annotations-status').hover(function() {
                jQuery('.hover-inst').toggleClass("hidden");
        });

        // Actually toggles whether annotaitons are displayed or not
        jQuery('.annotations-status').click(function() {
            self.toggleAnnotations();
        });

        // helper function to turn off keyboard-input mode
        var clearKeyboardInput = function() {
            // set content back to normal, without outlines or editable items
            // removes role and tabindex so user can read text without it thinking
            // the content is within a text block
            jQuery('.content').attr('contenteditable', 'false');
            jQuery('.content').attr('role', '');
            jQuery('.content').attr('tabindex', '');
            jQuery('.content').attr('aria-multiline', 'false');
            jQuery('.content').css('outline', '0px');

            // toggles the keyboard-input panel below to original state
            jQuery('#make_annotations_panel button').attr('data-toggled', 'false');
            jQuery('#make_annotations_panel button').html("Make an annotation");
            jQuery('#annotation-maker').addClass("hidden");

            // sets the html back to before being marked using delimiter
            jQuery(AController.annotationCore.annotation_tool.wrapper[0]).html(window.originalContent);
            
            // restarts annotator so it draws the new annotation
            Annotator._instances[0].destroy();
            AController.annotationCore.element = jQuery('.content');
            AController.annotationCore.init("text");
        };

        // function from: http://stackoverflow.com/questions/4811822/get-a-ranges-start-and-end-offsets-relative-to-its-parent-container
        var getTextCursor = function (element) {
            var caretOffset = 0;
            var doc = element.ownerDocument || element.document;
            var win = doc.defaultView || doc.parentWindow;
            var sel;
            if (typeof win.getSelection != "undefined") {
                sel = win.getSelection();
                if (sel.rangeCount > 0) {
                    var range = win.getSelection().getRangeAt(0);
                    var preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(element);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    caretOffset = preCaretRange.toString().length;
                }
            } else if ( (sel = doc.selection) && sel.type != "Control") {
                var textRange = sel.createRange();
                var preCaretTextRange = doc.body.createTextRange();
                preCaretTextRange.moveToElementText(element);
                preCaretTextRange.setEndPoint("EndToEnd", textRange);
                caretOffset = preCaretTextRange.text.length;
            }
            return caretOffset;
        };

        /*
         * getRangesForDelimiter
         * It checks through the target text to check if the delimiter was used
         * If so it expects there to be at least and at most 2 instances
         * It will then perform a calculation to get the appropriate SerializedRange
         * Otherwise it should return undefined
         * 
         * @param {string} delimiter - string used for boundaries of range
         * @returns {SerializedRange} range for string between the pair of delimiters
         */
        var getRangesForDelimiter = function(delimiter){
            var range = document.createRange();

            found = [];

            /*
             * find_ranges
             * It checks to see if the node contains the delimiter
             * and if it does find the delimiter, it will add it to
             * the found list variable above
             *
             * @param {Number} item - index of the node
             * @param {object} value - actual node
             */
            var find_ranges = function(item, value){
                // if it's an  element node, search its children. We need textnodes
                if (value.nodeType === 1) {
                    jQuery.each(value.childNodes, find_ranges);
                } else if(value.nodeType === 3){

                    // stupid check to make sure that we are in a TextNode
                    if(value.nodeValue){

                        // gets the offset of the first delimiter
                        var index = value.nodeValue.indexOf(delimiter);

                        // if this is the second time we've found a delimiter
                        // and it's the first item in the list, then we hit a corner case
                        // The issue here is that the highlight would end on the first character
                        // of a new node, which would INCLUDE the first character being highlighted
                        // this was not the intention of the user, otherwise the index would have been 1
                        // The solution is to look back at previous siblings or previous parents
                        // and get the offset of the full nodeValue. 
                        if (found.length > 0 && index == 0) {
                            var siblingNode = value.previousSibling;

                            // make sure that previous sibling is not a break tag or a non-text node
                            while(siblingNode.nodeName == "BR"){
                                var currentNode = siblingNode;
                                siblingNode = siblingNode.previousSibling;
                                if (siblingNode === null) {
                                    siblingNode = currentNode.parentNode.previousSibling;
                                };
                            };

                            // try to find the last textnode while you are still in an element node
                            while (siblingNode.nodeType == 1) {
                                siblingNode = siblingNode.lastChild;
                            };

                            // add the node to the found list
                            found.push({"node": siblingNode, "offset": siblingNode.textContent.length});
                        } else if(index>-1) {
                            // the regular case is you've found the node and offset so push them
                            found.push({"node": value, "offset": value.textContent.indexOf(delimiter)});
                            
                            // corner case: start and end are in the same node
                            var secondIndex = value.textContent.indexOf(delimiter, index+1);
                            if (secondIndex > -1) {
                                found.push({"node": value, "offset": secondIndex});
                            }
                        }
                    }
                }
            };

            // using the "contains:()" selector in jquery, find where the delimiter appears.
            jQuery.each(
                jQuery('.content .annotator-wrapper').find('*:contains('+delimiter+')'), function(index, value) {
                    jQuery.each(value.childNodes, find_ranges);
                }
            );

            // double check we get 2 and only two items selected for highlighting
            if (found.length <= 0) {
                console.log("User did not highlight anything");
                return undefined;
            } else if (found.length == 1) {
                console.log("User only started a highglight and did not finish it");
                return undefined;
            } else if (found.length > 2) {
                console.log("User did not read instructions to only highlight one item at a time");
                return undefined;
            } else {

                // if everything went great, then create an appropriate range using Annotator
                var startNode = found[0].node;
                var startOffset = found[0].offset;
                console.log(startOffset);
                var endNode = found[1].node;
                var endOffset = found[1].offset;
                console.log(endOffset);
                if (endOffset !== 0) {
                    endOffset = endOffset - delimiter.length;
                };

                var root = AController.annotationCore.annotation_tool.wrapper[0];
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);

                // turn that into a serializedRange to be stored in the database
                if (typeof Annotator !== "undefined") {
                    bRange = new Annotator.Range.BrowserRange(range);
                    normedRange = bRange.normalize().limit(root);
                    serializedRange = normedRange.serialize(root, '.annotator-hl');
                    jQuery(root).html(window.originalContent);
                    return serializedRange;
                }
            }

            return undefined;
        };
        
        // deals with the button that turns on keyboard annotations
        jQuery('#make_annotations_panel button').click(function(){
            
            // if person is trying to start making an annotation via keyboard
            if (jQuery(this).attr('data-toggled') == "false") {

                // make the text editable and change UI to reflect change
                jQuery('.content').attr('contenteditable', 'true');
                jQuery(this).attr('data-toggled', 'true');
                jQuery('.content').attr('role', 'textbox');
                jQuery('.content').attr('tabindex', '0');
                jQuery('.content').attr('aria-multiline', 'true');
                jQuery(this).html("Save Highlights");
                
                // automatically bring person to beginning of target text
                // this helps orient a person using a screen reader
                jQuery('.content')[0].focus();

                // makes sure that key count is set to 0 again so that you
                // can only make two asterisks
                window.keyCount = 0;

                // in case this is not the first time that a person is making an annotation
                // via keyboard input, this unloads event. 
                jQuery('.content').off('keydown');
                jQuery('.content').on('keydown', function(event) {
                    var keyCode = event.keyCode;
                    // if you haven't already:
                    event = event || window.event;

                    switch(keyCode) {
                        // left arrow key
                        case 37:
                        // up arrow key
                        case 38:
                        // right arrow key
                        case 39:
                        // bottom arrow key
                        case 40:
                            // arrow keys should work normally
                            break;
                        // backspace key
                        case 8:

                            // make sure that item you are trying to backspace is the delimiter
                            // TODO: change this asterisk to delimiter
                                var deleted = jQuery('.content').text().charAt(getTextCursor(jQuery('.content')[0])-1) !== '*';
                                
                                // if it isn't an asterisk, prevent the user from deleting it
                                // likewise prevent them if they never even typed an asterisk in the first place
                                if (window.keyCount == 0 || deleted) {
                                // to cancel the event:
                                if( event.preventDefault) event.preventDefault();
                                return false;
                            } else {
                                window.keyCount = window.keyCount-1;
                            }
                            break;
                        // delete key
                        case 46:
                            // make sure item you are trying to [forward] delete is the delimiter
                            // TODO: change this asterisk to delimiter
                            var deleted = jQuery('.content').text().charAt(getTextCursor(jQuery('.content')[0])) !== '*';
                            
                            // like above, if it isn't an asterisk prevent user from deleting it
                            // likewise prevent them if they never even typed an asterisk in the first place
                            if (window.keyCount == 0 || deleted) {
                                // to cancel the event:
                                if( event.preventDefault) event.preventDefault();
                                return false;
                            } else {
                                window.keyCount = window.keyCount-1;
                            }
                            break;
                        // 8/* button
                        case 56:

                            // if person hit 8 and not * then prevent them from doing so
                            if (!event.shiftKey) {
                                // to cancel the event:
                                if( event.preventDefault) event.preventDefault();
                                return false;
                            }

                            // likewise prevent the if they were trying to add more than 2 delimiters
                            if (window.keyCount == 2) {
                                // to cancel the event:
                                if( event.preventDefault) event.preventDefault();
                                return false;
                            }
                            window.keyCount = window.keyCount+1;
                            break;
                        // Esc button
                        case 27:
                            // sets the target text back to normal and erases delimiter marks
                            clearKeyboardInput();
                            break;
                        // Enter button
                        case 13:
                            // submits highlights like pressing the "Save Highlights" button
                            jQuery('#make_annotations_panel button').click();
                            return false;
                            break;
                        // Tab button
                        case 9:
                            // moves it to the "Save Highlights" button
                            jQuery('#make_annotations_panel button')[0].focus();
                            return false;
                            break;
                        default:
                            // to cancel the event:
                            if( event.preventDefault) event.preventDefault();
                            return false;
                            break;
                    }
                });

                // save the original content of the tool so you can set it back to normal later
                window.originalContent = jQuery(AController.annotationCore.annotation_tool.wrapper[0]).html();
            } else if(jQuery(this).attr('data-toggled') == "true") {
                // if user has submitted highlights

                // find range of the delimiter
                // TODO: have a setting somewhere to set the delimiter
                var rangesForAsterisks = getRangesForDelimiter("*");

                // If it couldn't find any ranges, (i.e. you forgot one or both delimiters do nothing)
                // TODO: show a warning error
                if (typeof rangesForAsterisks === "undefined") {
                    jQuery('.content').css('outline', '2px solid red');
                    return;
                };

                // show the small form to add text and tags to annotation
                jQuery(this).attr('data-toggled', 'saving');
                jQuery('#make_annotations_panel').css('margin-left', '0px');
                jQuery('#make_annotations_panel').css('margin-top', '0px');
                jQuery('#annotation-maker').removeClass("hidden");
                jQuery(this).html("Save Annotation");
                
                // focus on the first one for screen reader's sake!
                jQuery('#id_annotation_text_screen_reader')[0].focus();

                // create an annotation to be saved once they've added text and tags
                window.savingAnnotation = {
                    "ranges" : [rangesForAsterisks],
                    "collectionId": AController.annotationCore.initOptions.collection_id,
                    "contextId": AController.annotationCore.initOptions.context_id,
                    "uri": AController.annotationCore.initOptions.object_id,
                    "permissions": {
                        "admin": [AController.annotationCore.annotation_tool.plugins.Permissions.user.id],
                        "read": [],
                        "update": [AController.annotationCore.annotation_tool.plugins.Permissions.user.id],
                        "delete": [AController.annotationCore.annotation_tool.plugins.Permissions.user.id],
                    },
                    "user": AController.annotationCore.annotation_tool.plugins.Permissions.user,
                    "archived": false,
                    "parent": "0",
                    "media": "text",
                };
            } else {
                clearKeyboardInput();

                // tags and text input, if tags is empty, change it to empty list
                var text = jQuery('#id_annotation_text_screen_reader').val();
                var tags = jQuery('#id_annotation_tag_screen_reader').val().split(' ');
                if (tags == "") {
                    tags = [];
                };

                // add them to the annotation to be saved
                window.savingAnnotation['text'] = text;
                window.savingAnnotation['tags'] = tags;

                // this sends a trigger to Annotator to tell it to send the annotation to be saved to the database
                AController.annotationCore.annotation_tool.plugins.Store.annotationCreated(window.savingAnnotation);

                // this adds the actual highlight to the target text
                AController.annotationCore.annotation_tool.setupAnnotation(window.savingAnnotation);

                // this adds the annotation to the dashboard
                AController.dashboardObjectController.annotationCreated(window.savingAnnotation);
            }
        });

        // display/hide options to input annotations via keyboard
        jQuery('#keyboard-input-toggle-text').click(function(){

            // toggles the bottom panel 
            jQuery('#make_annotations_panel').toggleClass("hidden");

            if (jQuery('#make_annotations_panel').hasClass('hidden')) {
                
                // if it is now hidden we turn the toggler button white and set target object
                // back to normal
                jQuery('#keyboard-input-toggle-text').css('color', 'white');
                clearKeyboardInput();

            } else {
                
                // if it's not hidden then we set the toggler button yellow and focus on
                // the new button -- helps screen reader users in a flow
                jQuery('#keyboard-input-toggle-text').css('color', '#FFFF00');
                setTimeout(
                    function(){
                        jQuery('#make_annotations_panel button')[0].focus();
                    }, 
                500);
            }
        });

        // toggles the label for toggling instructions
        jQuery('.toggle-instructions').click(function (){
            if (jQuery('.toggle-instructions').html() == "Collapse Instructions") {
                jQuery('.toggle-instructions').html('Expand Instructions');
            } else {
                jQuery('.toggle-instructions').html('Collapse Instructions');
            }
        });
    };

    $.TargetObjectController.prototype.setUpTargetAsImage = function(element, targetObject) {
        
        // creates a qtip with instructions on how to make keyboard input
        var toggleqtip = function(){
            jQuery('#keyboard-input-button').qtip({
                id: 'key-control-annotation',
                content: {
                    text: "In order to use keyboard inputs, you must click on the image once. Then you can use the 'W', 'A', 'S', and 'D' keys to move up, left, down, and right respectively. You can also use '-' to zoom out, '=' to zoom in, and 'm' to make an annotation.",
                    // Use first steps content...
                    title: {
                        text: "Control via keyboard",
                        button: false
                    }
                },
                position: {
                    my: 'top center',
                    at: 'bottom center',
                    target: jQuery('#keyboard-input-button'),
                    // Also use first steps position target...
                    viewport: $(window) // ...and make sure it stays on-screen if possible
                },
                show: {
                    event: false,
                    // Only show when show() is called manually
                    ready: true // Also show on page load
                },
                events: {
                    render: function(event, api) {
                        // Grab tooltip element
                        var tooltip = api.elements.tooltip;
                    }
                }
            });
        };
        
        // when user clicks on the button, we set aria labels and focus on the OSD viewer
        // in order to toggle on keyboard input mode. mouseup allows focus to actually move
        // screen reader users to the appropriate div.
        jQuery('#keyboard-input-button').on('mouseup', function (event){
            jQuery('.keyboard-command-area').attr('aria-label', 'Click this button to turn on keyboard input. To use keyboard input, select this area. Then use "W", "A", "S", "D" to move around. "-" to zoom out, "=" to zoom in" and lowercase "m" to make an annotation.');
            jQuery('.openseadragon-canvas').attr('tabindex', '-1');
            
            document.getElementById('viewer').querySelector('.openseadragon-canvas').focus();
            jQuery('.keyboard-command-area')[0].focus();
            jQuery('#keyboard-input-button').css('color', '#ffff00');
        });

        // actually calls the qtip function above when user hovers over the keyboard button
        jQuery('#keyboard-input-button').on('mouseenter', function(){
            toggleqtip();
        });

        // also allows keyboard users to toggle qtip when they hit enter
        jQuery('#keyboard-input-button').on('keydown', function(event){
            var keyCode = event.keyCode;
            event = event || window.event;

            switch(keyCode) {
                case 32:
                case 13:
                    toggleqtip();
                    jQuery('#keyboard-input-button').css('color', '#ffff00');
                    break;
            }
        });
        
        // when keyboard users tab away from the keyboard button it hides the qtip
        jQuery('#keyboard-input-button').on('blur', function(event){
            if (event.tooltip !== undefined) {
                jQuery('#keyboard-input-button').qtip().toggle(false);
            };
        });

        // likewise the button is hidden when user stops hovering over it
        jQuery('#keyboard-input-button').on('mouseleave', function(event){
            jQuery('#keyboard-input-button').qtip().toggle(false);
        });

        jQuery('#viewer').off('keyup');

        // The following allows users to hit the 'm' key and "make" a new annotation
        jQuery('#viewer').on('keyup', function(event) {
            var keyCode = event.keyCode;
            // if you haven't already:
            event = event || window.event;

            switch(keyCode) {
                // 'm' key
                case 77:
                    // calls the dashboard to open up the fields to input annotation text
                    // and tags
                    AController.dashboardObjectController.annotationViaKeyboardInput();
                    
                    // allows users to close the modal page by hitting the close button
                    jQuery('.newreplygroup #delete').click(function (e) {
                        jQuery('.annotationModal #closeModal').click();
                    });

                    // when saving the new annotation we get all the metadata from Mirador
                    jQuery('.newreplygroup #save').click(function (e) {

                        // tags are set to empty array if they are input as empty string
                        var tags = jQuery('.replyItemEdit #id_tags').val().split(' ');
                        if (tags == ['']) {
                            tags = [];
                        };

                        // we get the bounds and construct the thumbnail
                        var miraWindow = AController.dashboardObjectController.endpoint.window;
                        var miraEndpoint = AController.dashboardObjectController.endpoint.endpoint;
                        var bounds = AController.dashboardObjectController.endpoint.currentImageBounds;
                        var thumb = Mirador.Iiif.getImageUrl(miraWindow.imagesList[Mirador.getImageIndexById(miraWindow.imagesList, miraWindow.currentCanvasID)]);
                        thumb = thumb + "/" + bounds.x + "," + bounds.y + "," + bounds.width + "," + bounds.height + "/full/0/native.jpg";
                        
                        // sets up the annotator structure to make the call to create an Annotation
                        var annotation = {
                            collectionId: miraEndpoint.collection_id,
                            contextId: miraEndpoint.context_id,
                            uri: miraWindow.currentCanvasID,
                            permissions: miraEndpoint.catchOptions.permissions,
                            user: miraEndpoint.catchOptions.user,
                            archived: false,
                            rangePosition: bounds,
                            bounds: bounds,
                            thumb: thumb,
                            ranges: [],
                            tags: tags,
                            text: jQuery('.replyItemEdit .replytext').val(),
                            parent: "0",
                            media: "image",
                        };

                        // makes a call to the backend to save the annotation
                        // TODO: Have this happen in Main instead of via here...
                        AController.dashboardObjectController.endpoint.endpoint.createCatchAnnotation(annotation);
                        jQuery('.annotationModal #closeModal').click();
                    });
                    break;
            }
        });
        };

        $.TargetObjectController.prototype.setUpTargetAsVideo = function(element, targetObject) {

        };

        $.TargetObjectController.prototype.colorizeAnnotation = function(annotationId, rgbColor) {
                if (this.initOptions.mediaType === "image") {
                        setTimeout(function(){
                                jQuery(".annotation#" + annotationId.toString()).css("border", "2px solid rgba(" + rgbColor.red + ", " + rgbColor.green + ", " + rgbColor.blue + ", " + rgbColor.alpha + ")");
                                window.tags = jQuery('.annotationItem.item-' + annotationId.toString()).find('.tag');
                                window.tags.each(function (index, item) {
                                        var tag = jQuery.trim(jQuery(item).html());
                                        var rgbColor = window.AController.main.tags[tag];
                                        if (rgbColor !== undefined) {
                                                jQuery(item).css("background-color", "rgba(" + rgbColor.red + ", " + rgbColor.green + ", " + rgbColor.blue + ", " + rgbColor.alpha + ")");
                                        };
                                })
                        }, 30);
                };
        };

        $.TargetObjectController.prototype.colorizeViewer = function (){
                window.tags = jQuery('.qtip').find('.tag');
                window.tags.each(function (index, item) {
                        var tag = jQuery.trim(jQuery(item).html());
                        var rgbColor = window.AController.main.tags[tag];
                        if (rgbColor !== undefined) {
                                jQuery(item).css("background-color", "rgba(" + rgbColor.red + ", " + rgbColor.green + ", " + rgbColor.blue + ", " + rgbColor.alpha + ")");
                        };
                });
        };

        $.TargetObjectController.prototype.colorizeEditor = function (){
                window.tags = jQuery('.token-input-token p');
                window.tags.each(function (index, item) {
                        var tag = jQuery.trim(jQuery(item).html());
                        var rgbColor = window.AController.main.tags[tag];
                        if (rgbColor !== undefined) {
                                jQuery(item).parent().css("background-color", "rgba(" + rgbColor.red + ", " + rgbColor.green + ", " + rgbColor.blue + ", " + rgbColor.alpha + ")");
                        };
                });
        };

        $.TargetObjectController.prototype.toggleAnnotations = function() {
                if (this.initOptions.mediaType === "text") {
                        var annotator = window.AController.annotationCore.annotation_tool;
                        var store = annotator.plugins.Store;
                        if (jQuery('.annotations-status').hasClass('on')) {
                                jQuery('.annotations-status .hover-inst').html("Show annotations");
                                jQuery('.annotations-status').attr('aria-label', "Show annotations");
                                jQuery('.annotations-status i').removeClass('fa-close');
                                jQuery('.annotations-status i').addClass('fa-comments');
                                this.annotationsSaved = store.annotations.slice();
                                window.AController.dashboardObjectController.endpoint._clearAnnotator();
                        } else {
                                jQuery('.annotations-status .hover-inst').html("Hide annotations");
                                jQuery('.annotations-status').attr('aria-label', "Hide annotations");
                                jQuery('.annotations-status i').addClass('fa-close');
                                jQuery('.annotations-status i').removeClass('fa-comments');
                                this.annotationsSaved.forEach(function (annotation) {
                                        annotator.setupAnnotation(annotation);
                                        store.registerAnnotation(annotation);
                                });
                                annotator.publish("externalCallToHighlightTags");
                        }
                        jQuery('.annotations-status').toggleClass("on");
                };
        }

}(AController));
