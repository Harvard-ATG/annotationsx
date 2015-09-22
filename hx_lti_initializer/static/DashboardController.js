/**
 *  DashboardController.js
 *	
 * This file contains all logic for the sidebar or bottombar in order to show
 * annotations in a table/list view instead of, or alongside, the mouseovers
 * in the target object. 
 **/
(function($) {

	$.DashboardController = function(options, commonInfo) {
		
		// sets up the default options
		var defaultOptions = {

			// media can be "text", "video", or "image"
			media: commonInfo.mediaType,
			userId: commonInfo.user_id,

			// if true, this will allow users to change between annotations for video, text,
			// or images that exist in the same page
			showMediaSelector: false,

			// if true this will allow users to switch between public/private
			showPublicPrivate: true,
			pagination: 50,
			flags: false,
		}

		this.element = options.annotationElement;

		this.initOptions = jQuery.extend({}, defaultOptions, options.initOptions, commonInfo);
		this.current_tab = this.initOptions.default_tab;
		
		// variables used when resizing dashboards
		this.resizing = false;
		this.lastUp = 150;
		this.writingReply = false;

		// set up template names that will be pulled
		this.TEMPLATENAMES = [
			"annotationSection",
			"annotationItem",
			"annotationModal",
			"replyItem",
		];

		this.queryDefault = {
			user_id: undefined,
			media: this.initOptions.mediaType,
		};

		this.addingAnnotations = false;

		this.init();
		
	};

	/* init
	 * 
	 */
	$.DashboardController.prototype.init = function() {
		// gets the current instance of the wrapper around the target object and annotator
		var wrapper = jQuery('.annotator-wrapper').parent()[0];
		var annotator = jQuery.data(wrapper, 'annotator');
		var self = this;
		this.annotator = annotator;
		
		// sets up all event listeners and their actions
		this._subscribeAnnotator();
		
		// actually compile templates
		// TODO: Allow instructor (or maybe even user) to switch between different dashboards
		this.TEMPLATES = {};
		this._compileTemplates("side");
		this.setUpSideDisplay([]);
		this.setUpButtons();
	};

	$.DashboardController.prototype.setUpButtons = function() {
		var self = this;
		var el = self.element;
		jQuery('#public').click(function (e){
			self.changeTab(e.target.innerHTML);
		});
		jQuery('#mynotes').click(function (e){
			self.changeTab(e.target.innerHTML);
		});
		jQuery('#instructor').click(function (e){
			self.changeTab(e.target.innerHTML);
		});
		jQuery('#users-filter').addClass('disabled');
		jQuery('#users-filter').click(function (e){
			jQuery('#users-filter').addClass('disabled');
			jQuery('#annotationtext-filter').removeClass('disabled');
			jQuery('#tag-filter').removeClass('disabled');
		});
		jQuery('#annotationtext-filter').click(function (e){
			jQuery('#users-filter').removeClass('disabled');
			jQuery('#annotationtext-filter').addClass('disabled');
			jQuery('#tag-filter').removeClass('disabled');
		});
		jQuery('#tag-filter').click(function (e){
			jQuery('#users-filter').removeClass('disabled');
			jQuery('#annotationtext-filter').removeClass('disabled');
			jQuery('#tag-filter').addClass('disabled');
		});
		jQuery('button#search-submit').click(function (e) {
			var text = jQuery('#srch-term').val();
			var search_filter = jQuery("button.query-filter.disabled").attr("id");
			if (search_filter === "users-filter"){
				self.queryDatabase({
					"username": text,
				});
			} else if (search_filter === "annotationtext-filter"){
				self.queryDatabase({
					"text": text,
				});
			} else if (search_filter === "tag-filter"){
				self.queryDatabase({
					"tag": text,
				})
			}
		});
		jQuery('button#search-clear').click(function (e) {
			jQuery('#srch-term').val("");
			self.changeTab(jQuery("button.user-filter.disabled").html());
		});

	};

	$.DashboardController.prototype.changeTab = function(def){
		if (def === "Public"){
			this.queryDatabase({
				"user_id": undefined,
			});
			jQuery('#public').addClass('disabled');
			jQuery('#mynotes').removeClass('disabled');
			jQuery('#instructor').removeClass('disabled');
		}
		else if (def === "My Notes"){
			this.queryDatabase({
				"user_id": this.initOptions.user_id,
			});
			jQuery('#mynotes').addClass('disabled');
			jQuery('#public').removeClass('disabled');
			jQuery('#instructor').removeClass('disabled');
		} else {
			var ids = this.initOptions.instructors;
			
			// Iterate over instructor ids, querying for their annotations
			for (var i = 0; i < ids.length; i++) {
				this.queryDatabase({
					"user_id": ids[i],
				});
			}
			jQuery('#instructor').addClass('disabled');
			jQuery('#public').removeClass('disabled');
			jQuery('#mynotes').removeClass('disabled');
		}
	};

	$.DashboardController.prototype.loadMoreAnnotations = function() {
		var annotator = this.annotator;

		// TODO: Change below to be a call to the Core Controller
		var loadFromSearch = annotator.plugins.Store.options.loadFromSearch;
		var numberOfAnnotations = jQuery('.annotationSection .annotationItem').length;

		loadFromSearch.limit = this.initOptions.pagination + numberOfAnnotations;
		annotator.plugins.Store.loadAnnotationsFromSearch(loadFromSearch);
	};

	$.DashboardController.prototype._subscribeAnnotator = function() {
		var self = this;
		var annotator = this.annotator;

		var annotationClicked = self.__bind(self.annotationClicked, self);
		var el = self.element;
		el.on("click", ".annotationItem", annotationClicked);
		annotator.subscribe("annotationsLoaded", function (annotations) {
			if (self.addingAnnotations){
				self.addAnnotations('.annotationsHolder', annotations, "after");
				self.addingAnnotations = false;
			} else {
				self.clearDashboard();
				self.createNewList(annotator.plugins.Store.annotations);
			}
		});
		annotator.subscribe("annotationCreated", function (annotation) {
			var attempts = 0;
			var isChanged = function (){
				if (attempts < 100){
					setTimeout(function(){
						if(typeof annotation.id !== 'undefined'){
							if(annotation.media === "comment") {
								self.addAnnotations('.repliesList', [annotation], "after");
							} else {
								self.addAnnotations('.annotationsHolder', [annotation], "before");
							}
						} else {
							attempts++;
							isChanged();
						}
					}, 100);
				}
			};
			isChanged();
		});
		annotator.subscribe("annotationUpdated", function (annotation) {
			var annotationItem = self.formatAnnotation(annotation);
			var date = new Date(annotationItem.updated);
			var dateAgo = jQuery.timeago(date);
			if( jQuery('.annotationModal').length > 0 ) {
				jQuery('.parentAnnotation .annotatedAt').html("last updated " + dateAgo);
				jQuery('.parentAnnotation .annotatedAt').attr("title", date);
				jQuery('.parentAnnotation .body').html(annotationItem.text);
			}

			var divObject = '.annotationItem.item-'+annotation.id.toString();
			console.log(divObject);
			jQuery(divObject + ' .annotatedAt').html("last updated" + dateAgo);
			jQuery(divObject + ' .annotatedAt').attr("title", date);
			jQuery(divObject + ' .body').html(annotationItem.text);
			var tagHtml = ""
			annotationItem.tags.forEach(function(tag){
				tagHtml += "<div class=\"tag side\">" + tag + "</div>"
			});
			jQuery(divObject + ' .tagList').html(tagHtml);
		});
		annotator.subscribe("annotationDeleted", function (annotation) {
			if (jQuery('.annotationModal').length > 0) {
				jQuery('.annotationModal').remove();
    			jQuery('.annotationSection').css('y-scroll', 'scroll');
			}
			var divObject = '.annotationItem.item-'+annotation.id.toString();
			jQuery(divObject).remove();
		});
	};

	$.DashboardController.prototype.clearDashboard = function(){
		var el = this.element;
		jQuery('.annotationsHolder').html("");
	};

	$.DashboardController.prototype.createNewList = function(annotations){
		var self = this;
		var el = self.element;
		var self = this;
		annotations.forEach(function(annotation) {
			var item = self.formatAnnotation(annotation);
			var html = self.TEMPLATES.annotationItem(item);
			jQuery('.annotationsHolder').append(html);
		});
		
	};

	$.DashboardController.prototype._compileTemplates = function(templateType){
    	var self = this;
    	self.TEMPLATENAMES.forEach(function(templateName) {
    		var template_url = self.initOptions.template_urls + templateName + '_' + templateType + '.html';
    		jQuery.ajax({
                url: template_url, 
                success: function (data) {
    		        var template = _.template(data);
    		        self.TEMPLATES[templateName] = template;
    		    },
                async: false,
            });
    	});
    	
    };

	$.DashboardController.prototype.setUpSideDisplay = function(annotations) {
		var self = this;
		var el = self.element;
		el.html(self.TEMPLATES.annotationSection({
			annotationItems: [],
		}));
		self.createNewList(annotations);
		jQuery('.resize-handle.side').on('mousedown', function(e){
			self.resizing = true;
		});

		jQuery(document).on('mousemove', function(e){
			if (!self.resizing){
				return;
			}
			e.preventDefault();
			var section = jQuery('.annotationSection');
			section.css('min-width', '0px');
			var offset = section.width()-(e.clientX - section.offset().left);
			section.css('width', offset);
			section.css('right', 0);
			self.lastUp = offset;
		}).on('mouseup', function(e){
			self.resizing = false;
			var section = jQuery('.annotationSection');
			if(self.lastUp < 150){
				jQuery('#leftCol').attr('class', 'col-xs-11');
				section.css('width', '0px');
				section.css('right', -10);
			} else {
				jQuery('#leftCol').attr('class', 'col-xs-7');
				section.css('min-width', '150px');
			}
		});
		jQuery('.annotationSection').scroll(function() {
			if(jQuery(this).scrollTop() + jQuery(this).innerHeight() >= this.scrollHeight){
				this.addingAnnotations = true;
				self.loadMoreAnnotations();
			}
		});
		self.changeTab(this.initOptions.default_tab);
	};

	$.DashboardController.prototype.addAnnotations = function(element, annotations, location) {
		var self = this;
		annotations.forEach(function(annotation) {
			var item = self.formatAnnotation(annotation);
			var html = ''
			if (element.indexOf('replies') === -1){
				html = self.TEMPLATES.annotationItem(item);
			} else {
				html = self.TEMPLATES.replyItem(item);
			}
			if (location === "before") {
				jQuery(element).prepend(html);
			} else {
				jQuery(element).append(html);
			}
		});
	};

	$.DashboardController.prototype.createDateFromISO8601 = function(string) {
		var d, date, offset, regexp, time, _ref;
		regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" + "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\\.([0-9]+))?)?" 
		       + "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
		d = string.match(new RegExp(regexp));
		offset = 0;
		date = new Date(d[1], 0, 1);
		if (d[3]) {
			date.setMonth(d[3] - 1);
		}
		if (d[5]) {
			date.setDate(d[5]);
		}
		if (d[7]) {
			date.setHours(d[7]);
		}
		if (d[8]) {
			date.setMinutes(d[8]);
		}
		if (d[10]) {
			date.setSeconds(d[10]);
		}
		if (d[12]) {
			date.setMilliseconds(Number("0." + d[12]) * 1000);
		}
		if (d[14]) {
			offset = (Number(d[16]) * 60) + Number(d[17]);
			offset *= (_ref = d[15] === '-') != null ? _ref : {
				1: -1
			};
		}
		offset -= date.getTimezoneOffset();
		time = Number(date) + (offset * 60 * 1000);
		date.setTime(Number(time));
		return date;
	};

	$.DashboardController.prototype.__bind = function(fn, me) { 
	    return function() { 
	        return fn.apply(me, arguments); 
    	}
    }; 

	$.DashboardController.prototype.formatAnnotation = function(annotation) {
		var item = jQuery.extend(true, {}, annotation);
		var self = this;
		if (typeof item.updated !== 'undefined')
            item.updated = self.createDateFromISO8601(item.updated);
        var permissions = self.annotator.plugins.Permissions;
        var authorized = permissions.options.userAuthorize('delete', annotation, permissions.user);
        var updateAuthorized = permissions.options.userAuthorize('update', annotation, permissions.user);
        item.authToDeleteButton = authorized;
        item.authToEditButton = updateAuthorized;
        item.authorized = authorized || updateAuthorized;
        return item;
	};

	$.DashboardController.prototype.queryDatabase = function(options) {
		var setOptions = jQuery.extend({}, this.queryDefault, options);
		var annotator = this.annotator;

		// TODO: Change below to be a call to the Core Controller
		var loadFromSearch = annotator.plugins.Store.options.loadFromSearch;
		var numberOfAnnotations = jQuery('.annotationSection .annotationItem').length;
		loadFromSearch.limit = this.initOptions.pagination + numberOfAnnotations;
		loadFromSearch.offset = 0;
		loadFromSearch.media = setOptions.media;
		loadFromSearch.userid = setOptions.user_id;
		loadFromSearch.username = setOptions.username;
		loadFromSearch.text = setOptions.text;
		loadFromSearch.tag = setOptions.tag;
		this._clearAnnotator();
		annotator.plugins.Store.loadAnnotationsFromSearch(loadFromSearch);
	};

	// TODO (Move to Annotator Core)
	$.DashboardController.prototype._clearAnnotator = function() {
        var annotator = this.annotator;
        var store = annotator.plugins.Store;
        var annotations = store.annotations.slice();
        
        annotations.forEach(function(ann){
            var child, h, _i, _len, _ref;
            if (ann.highlights !== undefined) {
                _ref = ann.highlights;
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    h = _ref[_i];
                    if (!(h.parentNode !== undefined)) {
                        continue;
                    }
                    child = h.childNodes[0];
                    jQuery(h).replaceWith(h.childNodes);
                }
            }
            store.unregisterAnnotation(ann);
        });
    };

    $.DashboardController.prototype.annotationClicked = function(e) {
    	var self = this;
    	var target = jQuery(e.target);
    	var annotation_id = target.find(".idAnnotation").html();

    	// this next part is to double check that idannotation is grabbed from
    	// within the tags and the quotes section
    	while (annotation_id === undefined){
    		target = target.parent();
    		annotation_id = target.find(".idAnnotation").html();
    	}

    	var annotationItem = self.getAnnotationById(annotation_id, true);
    	var html = self.TEMPLATES.annotationModal(annotationItem);
    	jQuery('.annotationSection').append(html);
    	jQuery('.annotationSection').css('y-scroll', 'hidden');
    	jQuery('.annotationModal #closeModal').click( function (e) {
    		jQuery('.annotationModal').remove();
    		jQuery('.annotationSection').css('y-scroll', 'scroll');
    	});
    	jQuery('.annotationModal button.replybutton').click( function (e) {
    		var button = jQuery(e.target);
    		var positionAdder = {
    			display: "block",
    			left: button.offset().left,
    			top: button.offset().top,
    		}
    		self.annotator.adder.css(positionAdder);
    		self.annotator.onAdderClick();
    		var parent = jQuery(self.annotator.editor.element).find('.reply-item span.parent-annotation');
    		parent.html(annotation_id);
    	});
    	self.getRepliesOfAnnotation(annotation_id);
    	jQuery('.parentAnnotation .quoteText').click( function(e){
    		var annotations = self.annotator.plugins.Store.annotations;
    		for(var item in annotations){
    			var annotation = annotations[item]; 
    			if (annotation.id.toString() === annotation_id) {
    				jQuery('html, body').animate({
    					scrollTop: jQuery(annotation.highlights[0]).offset().top },
    					'slow'
    				);
    			};
    		}
    	});
    	jQuery('.parentAnnotation #edit').click(function (e){
    		self.editAnnotation(annotation_id, e);
    	});
		jQuery('.parentAnnotation [data-toggle="confirmation"]').confirmation({
			title: "Would you like to delete your annotation?",
			onConfirm: function (){
				if(annotationItem.authToDeleteButton){
					var annotation_to_delete = self.getAnnotationById(annotation_id, false);
					self.annotator.deleteAnnotation(annotation_to_delete);
				}
			},
		});
    };

    $.DashboardController.prototype.editAnnotation = function(annotation_id, event){
    	var self = this;
    	var annotationItem = self.getAnnotationById(annotation_id, true);
    	console.log(annotationItem);
		if (annotationItem.authToEditButton) {
			var button = jQuery(event.target);

			var positionAdder = {
    			display: "block",
    			left: button.offset().left,
    			top: button.scrollTop(),
    		}

    		var annotation_to_update = self.getAnnotationById(annotation_id, false);
    		
    		var update_parent = function() {
             	cleanup_parent();
            	var response = self.annotator.updateAnnotation(annotation_to_update);
            	return response;
            };
            var cleanup_parent = function() {
            	self.annotator.unsubscribe('annotationEditorHidden', cleanup_parent);
            	return self.annotator.unsubscribe('annotationEditorSubmit', update_parent);
            };

            self.annotator.subscribe('annotationEditorHidden', cleanup_parent);
            self.annotator.subscribe('annotationEditorSubmit', update_parent);
    		self.annotator.showEditor(annotation_to_update, positionAdder);
    		
    		jQuery('.annotator-widget').addClass('fullscreen');
		}
    };

    // TODO Move to AnnotationCore
    $.DashboardController.prototype.getAnnotationById = function(id, formatted){
    	var annotationId = parseInt(id, 10);
    	var self = this;
    	var annotator = self.annotator;
    	var annotations = annotator.plugins.Store.annotations.slice();

    	for (var index in annotations) {
    		var annotation = annotations[index];
    		if (annotation.id === annotationId){
    			if (formatted){
    				return self.formatAnnotation(annotation);
    			} else {
    				return annotation;
    			}
    		}
    	} 
    	return undefined;
    };
	
	$.DashboardController.prototype.sortAnnotationsByCreated = function(annotations) {
		var compareCreated = function(a, b) {
			if (!("created" in a && "created" in b)) {
				return 0;
			}
			// get the ISO8601 time w/o the TZ so it's parseable by Date()
			// and then compare the millisecond values.
			// Ex: "2015-09-22T16:30:00 UTC" => Date.parse("2015-09-22T16:30:00") => 1442939400000
			t1 = Date.parse(a.created.split(' ', 2)[0]); 
			t2 = Date.parse(b.created.split(' ', 2)[0]);
			return t1 > t2;
		};
		
		sorted_annotations = (annotations||[]).slice(); // shallow copy to preserve order of original array
		sorted_annotations.sort(compareCreated); // sort in place
		return sorted_annotations;
	};

    $.DashboardController.prototype.getRepliesOfAnnotation = function(annotation_id) {
    	var anId = parseInt(annotation_id, 10);
    	var self = this;
    	var annotator = self.annotator;
    	var store = annotator.plugins.Store;
    	var oldLoadFromSearch = annotator.plugins.Store.options.loadFromSearch;
    	var annotation_obj_id = oldLoadFromSearch.uri;
    	var context_id = oldLoadFromSearch.contextId;
    	var collection_id = oldLoadFromSearch.collectionId;

    	var newLoadFromSearch = {
    		limit: -1,
    		parentid: anId,
    		media: "comment",
    		uri: annotation_obj_id,
    		contextId: context_id,
    		collectionId: collection_id,
    	}

    	var onSuccess = function(data) {
    		if (data === null) {
    			data = {};
    		}
    		var annotations = self.sortAnnotationsByCreated(data.rows||[]);
    		var replies_offset = jQuery('.parentAnnotation').offset().top -jQuery('.annotationModal').offset().top + jQuery('.parentAnnotation').height();
    		var replies_height = jQuery(window).height() - jQuery('.replybutton').height() - jQuery('.parentAnnotation').height() - jQuery('.modal-navigation').height();
    		jQuery('.repliesList').css('margin-top', replies_offset);
    		jQuery('.repliesList').css('height', replies_height);
    		var final_html = '';
    		self.list_of_replies = {}
    		annotations.forEach(function(annotation) {
				var item = self.formatAnnotation(annotation);
				var html = self.TEMPLATES.replyItem(item);
				final_html += html;
				self.list_of_replies[item.id.toString()] = annotation;
			});
			jQuery('.repliesList').html(final_html);
    	}

    	var search_url = store._urlFor("search", annotation_id);
        var options = store._apiRequestOptions("search", newLoadFromSearch, onSuccess);
        var request = jQuery.ajax(search_url, options);

        var replyDeleteClicked = self.__bind(self.replyDeleteClicked, self);
		var el = self.element;
		el.on("click", ".replyItem .replyeditgroup #delete", replyDeleteClicked);
    };

    $.DashboardController.prototype.replyDeleteClicked = function(e) {
    	var self = this;
    	var replyItem = jQuery(e.target).parent().parent();
    	var annotation_id = replyItem.find('.idAnnotation').html();
    	var annotation = self.list_of_replies[annotation_id];
    	jQuery(e.target).confirmation({
			title: "Would you like to delete your reply?",
			onConfirm: function (){
				self.annotator.plugins.Store._apiRequest('destroy', annotation, function(){});
				replyItem.remove();
			},
		});
		jQuery(e.target).confirmation('show');
};

}(AController));