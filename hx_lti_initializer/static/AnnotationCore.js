/***
 * AnnotatorCore.js
 *
 * This file will contain the functions needed to access and use
 * whatever library is currently the norm for annotations.
 * As of Spring 2015, the norm is to use annotator.js
 * This is the page that should change if/when that tool changes.
 ***/

(function($) {
	$.AnnotationCore = function(options, commonInfo) {
		// HTMLElement that contains what should be annotated
		this.element = options.annotationElement;

		// contains any other options needed to initialize the tool
		this.initOptions = jQuery.extend({}, options.initOptions, commonInfo);

		// initializes tool
		this.init(this.initOptions.mediaType);

		return this;
	};

	/* init
	 * The following function initializes the annotation core library
	 * it should change depending on what the library we are using is.
	 * Currently we are using annotator.js and thus the following
	 * initializes and depends on those libraries being present.
	 */
	$.AnnotationCore.prototype.init = function(mediaType){
		// use this space to mold initOptions into whatever shape you need it to be
		var annotatorOptions = this.initOptions;
		
		// sets up the store for the common settings for the tool, specifically Annotation Database
		this.setUpCommonAttributes();

		if (mediaType === "text") {
			// create the annotation core holder to be able to access it throughout the tool
			this.annotation_tool = jQuery(this.element).annotator(annotatorOptions).data('annotator');
			this.setUpPlugins();

			// need to make sure that the media is defaulted to text (even if the "reply" plugin is not instantiated)
			this.annotation_tool.subscribe("annotationEditorSubmit", function(editor, annotation){
				if (annotation.parent === "0" || annotation.parent === 0 || typeof Annotator.Plugin["Reply"] !== 'function') {
					annotation.media = "text";
				}
			});
		} else if(mediaType === "video") {
			this.annotation_tool = jQuery(this.element).annotator(annotatorOptions).data('annotator');
			this.setUpPlugins();

			// need to make sure that the media is defaulted to text (even if the "reply" plugin is not instantiated)
			this.annotation_tool.subscribe("annotationEditorSubmit", function(editor, annotation){
				if (annotation.parent === "0" || annotation.parent === 0 || typeof Annotator.Plugin["Reply"] !== 'function') {
					annotation.media = "video";
				}
			});

			jQuery(document).trigger('annotation_core_init');
		}
	};

	/* setUpCommonAttributes
	 * Init some plugins or options that are common between text, video, and image.
	 */
	$.AnnotationCore.prototype.setUpCommonAttributes = function(){
		var annotatorOptions = this.initOptions

		// checks to make sure whether the store attribute exists
		if (typeof annotatorOptions.store === "undefined"){
			annotatorOptions.store = {};
		}

		// as with above, the store needs to be set up a specific way
		var store = annotatorOptions.store;
	    if (typeof store.annotationData === 'undefined'){
	        store.annotationData = {};
	    }

	    // new mechanic, the following three options contains all the information you would
	    // need to know to determine where the annotation belongs, object_id is the id of the
	    // target source, it can exist in multiple assignments and multiple courses. context_id
	    // refers to the course it belongs to and collection_id is the assignment the object belongs to
	    if (typeof store.annotationData.uri === 'undefined'){
	        var tempUri = "" + annotatorOptions.object_id;
	    }
	    if (typeof store.annotationData.context_id === 'undefined'){
	        store.annotationData.context_id = annotatorOptions.context_id;
	    }
	    if (typeof store.annotationData.collection_id === 'undefined'){
	        store.annotationData.collection_id = annotatorOptions.collection_id;
	    }

	    // the following are options for the first retrieval of information from the Annotation Database
	    if (typeof store.loadFromSearch === 'undefined'){
	        store.loadFromSearch = {};
	    }
	    if (typeof store.loadFromSearch.uri === 'undefined'){
	        store.loadFromSearch.uri = store.annotationData.uri;
	    }
	    if (typeof store.loadFromSearch.limit === 'undefined'){
	        store.loadFromSearch.limit = 10000;
	    }
	};

	$.AnnotationCore.prototype.buildStoreUrl = function(url) {
		var k, v, query = [], query_string = '';
		for(k in this.initOptions.database_params) {
			v = this.initOptions.database_params[k];
			if(v !== '') {
				query.push([k,v].join("="));
			}
		}
		query_string = query.join("&");
		if(query_string == '') {
			return url;
		}
		return url + '?' + query_string;
	};

	$.AnnotationCore.prototype.setUpPlugins = function() {
	    for (var plugin in this.initOptions.plugins){
	    	var pluginName = this.initOptions.plugins[plugin];
	    	var options = {};
	    	if (pluginName === "Store") {
		    	options = {
		    		// The endpoint of the store on your server.
	                prefix: this.initOptions.database_url,
	                annotationData: {
	                    uri: this.initOptions.object_id,
	                    collectionId: this.initOptions.collection_id,
	                    contextId: this.initOptions.context_id,
	                    citation: this.initOptions.citation,
	                },
	                urls: {
	                    // These are the default URLs.
	                    create:  this.buildStoreUrl('/create'), 
	                    read:    this.buildStoreUrl('/read/:id'), 
	                    update:  this.buildStoreUrl('/update/:id'),
	                    destroy: this.buildStoreUrl('/delete/:id'),
	                    search:  this.buildStoreUrl('/search')
	                },
	                loadFromSearch:{
	                    uri: this.initOptions.object_id,
	                    collectionId: this.initOptions.collection_id,
	                    contextId: this.initOptions.context_id,
	                    media: this.initOptions.mediaType,
	                    limit: this.initOptions.pagination,
	                }
		    	};
		    	
		    } else if (pluginName === 'Auth') {
		    	options = {
		    		token: this.initOptions.token,
		    	};
		    } else if (pluginName === 'Permissions') {
		    	var self = this;
		    	options = {
	                user: {
	                    id: this.initOptions.user_id,
	                    name: this.initOptions.username,
	                },
	                permissions: {
	                        'read':   [],
	                        'update': [this.initOptions.user_id,],
	                        'delete': [this.initOptions.user_id,],
	                        'admin':  [this.initOptions.user_id,]
	                },
	                showViewPermissionsCheckbox: this.initOptions.showViewPermissionsCheckbox,
	                showEditPermissionsCheckbox: false,
	                userString: function (user) {
	                    if (user && user.name)
	                        return user.name;
	                    return user;
	                },
	                userId: function (user) {
	                    if (user && user.id)
	                        return user.id;
	                    return user;
	                },
	                userAuthorize: function(action, annotation, user) {
	                    var token, tokens, _i, _len;
	                    if (annotation.permissions) {
	                      tokens = annotation.permissions[action] || [];
	                      if (tokens.length === 0) {
	                        return true;
	                      }
	                      for (var item in tokens) {
	                        token = tokens[item];
	                        if (this.userId(user) === token) {
	                          return true;
	                        }
	                      }
	                      return self.initOptions.is_instructor === "True";
	                    } else if (annotation.user) {
	                      if (user) {
	                        return this.userId(user) === this.userId(annotation.user);
	                      } else {
	                        return self.initOptions.is_instructor === "True";
	                      }
	                    }
	                    return true;
	                  },
			    }
		    } else if (pluginName === "HighlightTags") {
		    	options = {
		            tag: this.initOptions.highlightTags_options,
		    	}
		    }
			console.log("Adding plugin " + pluginName + " with options: ", options);
		    
		    this.annotation_tool.addPlugin(pluginName, options);
	    }
	};
	$.AnnotationCore.prototype.alert = function(error) {
		var overlaybckg = document.createElement('div');
        var overlaydialog = document.createElement('div');
        jQuery(overlaybckg).css({
            "background-color": "rgba(33, 33, 33, 0.3)",
            "width": "100%",
            "height": "100%",
            "position": "fixed",
            "top": "0",
            "left": "0",
            "z-index": "999"
        });
        overlaybckg.id = 'hx-temp-overlay';
        jQuery(overlaydialog).css({
            "background-color": "white",
            "width": "500px",
            "height": "420px",
            "margin-left": "-250px",
            "margin-top": "-200px",
            "top": "50%",
            "left": "50%",
            "position": "fixed",
            "z-index": "9999",
            "border": "4px solid black",
            "border-radius": "10px",
        });
        jQuery(overlaydialog).html("<h3 style='padding-left: 50px; padding-top:10px;'>Uh oh!</h3><p style='padding: 0px 50px;'>Something went wrong with the annotation database. Unfortunately, this means that we are not able to save your annotations or show you the annotations of instructors and other learners. The most common reason is if you were inactive in this page for a while. We recommend refreshing the page or changing browsers.</p> <button role='button' class='btn btn-success' style='margin:5px 50px;width:400px;' id='takemethere' onclick='window.open(\"/troubleshooting/\", \"_blank\");'>Visit troubleshooting page</button><button role='button' class='btn btn-danger' style='margin: 10px 50px;width:400px;' id='ignorewarning'>Proceed without annotations</button> <p style='padding: 10px 50px; text-align:center;'>(Clicking \"Proceed without annotations\" will allow you to view the assignment you are trying to annotate. Unfortunately your annotations will not be saved and you will not see instructor or other leareners' annotations.)</p>");
        jQuery(overlaybckg).append(overlaydialog);
        jQuery("body").append(overlaybckg);
        jQuery('#ignorewarning').click(function(){
            jQuery('#hx-temp-overlay').remove();
        });
	}

}(AController));
