define("ghost/adapters/application", 
  ["ghost/adapters/embedded-relation-adapter","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EmbeddedRelationAdapter = __dependency1__["default"];

    
    var ApplicationAdapter = EmbeddedRelationAdapter.extend();
    
    __exports__["default"] = ApplicationAdapter;
  });
define("ghost/adapters/base", 
  ["ghost/utils/ghost-paths","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ghostPaths = __dependency1__["default"];

    
    var BaseAdapter = DS.RESTAdapter.extend({
        host: window.location.origin,
        namespace: ghostPaths().apiRoot.slice(1),
    
        findQuery: function (store, type, query) {
            var id;
    
            if (query.id) {
                id = query.id;
                delete query.id;
            }
    
            return this.ajax(this.buildURL(type.typeKey, id), 'GET', {data: query});
        },
    
        buildURL: function (type, id) {
            // Ensure trailing slashes
            var url = this._super(type, id);
    
            if (url.slice(-1) !== '/') {
                url += '/';
            }
    
            return url;
        },
    
        // Override deleteRecord to disregard the response body on 2xx responses.
        // This is currently needed because the API is returning status 200 along
        // with the JSON object for the deleted entity and Ember expects an empty
        // response body for successful DELETEs.
        // Non-2xx (failure) responses will still work correctly as Ember will turn
        // them into rejected promises.
        deleteRecord: function () {
            var response = this._super.apply(this, arguments);
    
            return response.then(function () {
                return null;
            });
        }
    });
    
    __exports__["default"] = BaseAdapter;
  });
define("ghost/adapters/embedded-relation-adapter", 
  ["ghost/adapters/base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseAdapter = __dependency1__["default"];

    
    // EmbeddedRelationAdapter will augment the query object in calls made to
    // DS.Store#find, findQuery, and findAll with the correct "includes"
    // (?include=relatedType) by introspecting on the provided subclass of the DS.Model.
    // In cases where there is no query object (DS.Model#save, or simple finds) the URL
    // that is built will be augmented with ?include=... where appropriate.
    //
    // Example:
    // If a model has an embedded hasMany relation, the related type will be included:
    // roles: DS.hasMany('role', { embedded: 'always' }) => ?include=roles
    
    var EmbeddedRelationAdapter = BaseAdapter.extend({
        find: function (store, type, id) {
            return this.ajax(this.buildIncludeURL(store, type, id), 'GET');
        },
    
        findQuery: function (store, type, query) {
            return this._super(store, type, this.buildQuery(store, type, query));
        },
    
        findAll: function (store, type, sinceToken) {
            var query = {};
    
            if (sinceToken) {
                query.since = sinceToken;
            }
    
            return this.findQuery(store, type, query);
        },
    
        createRecord: function (store, type, record) {
            return this.saveRecord(store, type, record, {method: 'POST'});
        },
    
        updateRecord: function (store, type, record) {
            var options = {
                method: 'PUT',
                id: Ember.get(record, 'id')
            };
    
            return this.saveRecord(store, type, record, options);
        },
    
        saveRecord: function (store, type, record, options) {
            options = options || {};
    
            var url = this.buildIncludeURL(store, type, options.id),
                payload = this.preparePayload(store, type, record);
    
            return this.ajax(url, options.method, payload);
        },
    
        preparePayload: function (store, type, record) {
            var serializer = store.serializerFor(type.typeKey),
                payload = {};
    
            serializer.serializeIntoHash(payload, type, record);
    
            return {data: payload};
        },
    
        buildIncludeURL: function (store, type, id) {
            var url = this.buildURL(type.typeKey, id),
                includes = this.getEmbeddedRelations(store, type);
    
            if (includes.length) {
                url += '?include=' + includes.join(',');
            }
    
            return url;
        },
    
        buildQuery: function (store, type, options) {
            var toInclude = this.getEmbeddedRelations(store, type),
                query = options || {},
                deDupe = {};
    
            if (toInclude.length) {
                // If this is a find by id, build a query object and attach the includes
                if (typeof options === 'string' || typeof options === 'number') {
                    query = {};
                    query.id = options;
                    query.include = toInclude.join(',');
                } else if (typeof options === 'object' || Ember.isNone(options)) {
                    // If this is a find all (no existing query object) build one and attach
                    // the includes.
                    // If this is a find with an existing query object then merge the includes
                    // into the existing object. Existing properties and includes are preserved.
                    query = query || {};
                    toInclude = toInclude.concat(query.include ? query.include.split(',') : []);
    
                    toInclude.forEach(function (include) {
                        deDupe[include] = true;
                    });
    
                    query.include = Object.keys(deDupe).join(',');
                }
            }
    
            return query;
        },
    
        getEmbeddedRelations: function (store, type) {
            var model = store.modelFor(type),
                ret = [];
    
            // Iterate through the model's relationships and build a list
            // of those that need to be pulled in via "include" from the API
            model.eachRelationship(function (name, meta) {
                if (meta.kind === 'hasMany' &&
                    Object.prototype.hasOwnProperty.call(meta.options, 'embedded') &&
                    meta.options.embedded === 'always') {
                    ret.push(name);
                }
            });
    
            return ret;
        }
    });
    
    __exports__["default"] = EmbeddedRelationAdapter;
  });
define("ghost/adapters/setting", 
  ["ghost/adapters/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationAdapter = __dependency1__["default"];

    
    var SettingAdapter = ApplicationAdapter.extend({
        updateRecord: function (store, type, record) {
            var data = {},
                serializer = store.serializerFor(type.typeKey);
    
            // remove the fake id that we added onto the model.
            delete record.id;
    
            // use the SettingSerializer to transform the model back into
            // an array of settings objects like the API expects
            serializer.serializeIntoHash(data, type, record);
    
            // use the ApplicationAdapter's buildURL method but do not
            // pass in an id.
            return this.ajax(this.buildURL(type.typeKey), 'PUT', {data: data});
        }
    });
    
    __exports__["default"] = SettingAdapter;
  });
define("ghost/adapters/user", 
  ["ghost/adapters/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationAdapter = __dependency1__["default"];

    
    var UserAdapter = ApplicationAdapter.extend({
        find: function (store, type, id) {
            return this.findQuery(store, type, {id: id, status: 'all'});
        }
    });
    
    __exports__["default"] = UserAdapter;
  });
define("ghost/app", 
  ["ember/resolver","ember/load-initializers","ghost/utils/link-view","ghost/utils/text-field","ghost/config","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var Resolver = __dependency1__["default"];

    var loadInitializers = __dependency2__["default"];



    var configureApp = __dependency5__["default"];

    
    Ember.MODEL_FACTORY_INJECTIONS = true;
    
    var App = Ember.Application.extend({
        modulePrefix: 'ghost',
        Resolver: Resolver.default
    });
    
    // Runtime configuration of Ember.Application
    configureApp(App);
    
    loadInitializers(App, 'ghost');
    
    __exports__["default"] = App;
  });
define("ghost/assets/lib/touch-editor", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var createTouchEditor = function createTouchEditor() {
        var noop = function () {},
            TouchEditor;
    
        TouchEditor = function (el, options) {
            /*jshint unused:false*/
            this.textarea = el;
            this.win = {document: this.textarea};
            this.ready = true;
            this.wrapping = document.createElement('div');
    
            var textareaParent = this.textarea.parentNode;
    
            this.wrapping.appendChild(this.textarea);
            textareaParent.appendChild(this.wrapping);
    
            this.textarea.style.opacity = 1;
        };
    
        TouchEditor.prototype = {
            setOption: function (type, handler) {
                if (type === 'onChange') {
                    $(this.textarea).change(handler);
                }
            },
            eachLine: function () {
                return [];
            },
            getValue: function () {
                return this.textarea.value;
            },
            setValue: function (code) {
                this.textarea.value = code;
            },
            focus: noop,
            getCursor: function () {
                return {line: 0, ch: 0};
            },
            setCursor: noop,
            currentLine: function () {
                return 0;
            },
            cursorPosition: function () {
                return {character: 0};
            },
            addMarkdown: noop,
            nthLine: noop,
            refresh: noop,
            selectLines: noop,
            on: noop,
            off: noop
        };
    
        return TouchEditor;
    };
    
    __exports__["default"] = createTouchEditor;
  });
define("ghost/assets/lib/uploader", 
  ["ghost/utils/ghost-paths","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ghostPaths = __dependency1__["default"];

    
    var UploadUi,
        upload,
        Ghost = ghostPaths();
    
    UploadUi = function ($dropzone, settings) {
        var $url = '<div class="js-url"><input class="url js-upload-url" type="url" placeholder="http://"/></div>',
            $cancel = '<a class="image-cancel js-cancel" title="Delete"><span class="hidden">Delete</span></a>',
            $progress =  $('<div />', {
                class: 'js-upload-progress progress progress-success active',
                role: 'progressbar',
                'aria-valuemin': '0',
                'aria-valuemax': '100'
            }).append($('<div />', {
                class: 'js-upload-progress-bar bar',
                style: 'width:0%'
            }));
    
        $.extend(this, {
            complete: function (result) {
                var self = this;
    
                function showImage(width, height) {
                    $dropzone.find('img.js-upload-target').attr({width: width, height: height}).css({display: 'block'});
                    $dropzone.find('.fileupload-loading').remove();
                    $dropzone.css({height: 'auto'});
                    $dropzone.delay(250).animate({opacity: 100}, 1000, function () {
                        $('.js-button-accept').prop('disabled', false);
                        self.init();
                    });
                }
    
                function animateDropzone($img) {
                    $dropzone.animate({opacity: 0}, 250, function () {
                        $dropzone.removeClass('image-uploader').addClass('pre-image-uploader');
                        $dropzone.css({minHeight: 0});
                        self.removeExtras();
                        $dropzone.animate({height: $img.height()}, 250, function () {
                            showImage($img.width(), $img.height());
                        });
                    });
                }
    
                function preLoadImage() {
                    var $img = $dropzone.find('img.js-upload-target')
                        .attr({src: '', width: 'auto', height: 'auto'});
    
                    $progress.animate({opacity: 0}, 250, function () {
                        $dropzone.find('span.media').after('<img class="fileupload-loading"  src="' + Ghost.subdir + '/ghost/img/loadingcat.gif" />');
                        if (!settings.editor) {$progress.find('.fileupload-loading').css({top: '56px'}); }
                    });
                    $dropzone.trigger('uploadsuccess', [result]);
                    $img.one('load', function () {
                        animateDropzone($img);
                    }).attr('src', result);
                }
                preLoadImage();
            },
    
            bindFileUpload: function () {
                var self = this;
    
                $dropzone.find('.js-fileupload').fileupload().fileupload('option', {
                    url: Ghost.apiRoot + '/uploads/',
                    add: function (e, data) {
                        /*jshint unused:false*/
                        $('.js-button-accept').prop('disabled', true);
                        $dropzone.find('.js-fileupload').removeClass('right');
                        $dropzone.find('.js-url').remove();
                        $progress.find('.js-upload-progress-bar').removeClass('fail');
                        $dropzone.trigger('uploadstart', [$dropzone.attr('id')]);
                        $dropzone.find('span.media, div.description, a.image-url, a.image-webcam')
                            .animate({opacity: 0}, 250, function () {
                                $dropzone.find('div.description').hide().css({opacity: 100});
                                if (settings.progressbar) {
                                    $dropzone.find('div.js-fail').after($progress);
                                    $progress.animate({opacity: 100}, 250);
                                }
                                data.submit();
                            });
                    },
                    dropZone: settings.fileStorage ? $dropzone : null,
                    progressall: function (e, data) {
                        /*jshint unused:false*/
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        if (!settings.editor) {$progress.find('div.js-progress').css({position: 'absolute', top: '40px'}); }
                        if (settings.progressbar) {
                            $dropzone.trigger('uploadprogress', [progress, data]);
                            $progress.find('.js-upload-progress-bar').css('width', progress + '%');
                        }
                    },
                    fail: function (e, data) {
                        /*jshint unused:false*/
                        $('.js-button-accept').prop('disabled', false);
                        $dropzone.trigger('uploadfailure', [data.result]);
                        $dropzone.find('.js-upload-progress-bar').addClass('fail');
                        if (data.jqXHR.status === 413) {
                            $dropzone.find('div.js-fail').text('The image you uploaded was larger than the maximum file size your server allows.');
                        } else if (data.jqXHR.status === 415) {
                            $dropzone.find('div.js-fail').text('The image type you uploaded is not supported. Please use .PNG, .JPG, .GIF, .SVG.');
                        } else {
                            $dropzone.find('div.js-fail').text('Something went wrong :(');
                        }
                        $dropzone.find('div.js-fail, button.js-fail').fadeIn(1500);
                        $dropzone.find('button.js-fail').on('click', function () {
                            $dropzone.css({minHeight: 0});
                            $dropzone.find('div.description').show();
                            self.removeExtras();
                            self.init();
                        });
                    },
                    done: function (e, data) {
                        /*jshint unused:false*/
                        self.complete(data.result);
                    }
                });
            },
    
            buildExtras: function () {
                if (!$dropzone.find('span.media')[0]) {
                    $dropzone.prepend('<span class="media"><span class="hidden">Image Upload</span></span>');
                }
                if (!$dropzone.find('div.description')[0]) {
                    $dropzone.append('<div class="description">Add image</div>');
                }
                if (!$dropzone.find('div.js-fail')[0]) {
                    $dropzone.append('<div class="js-fail failed" style="display: none">Something went wrong :(</div>');
                }
                if (!$dropzone.find('button.js-fail')[0]) {
                    $dropzone.append('<button class="js-fail btn btn-green" style="display: none">Try Again</button>');
                }
                if (!$dropzone.find('a.image-url')[0]) {
                    $dropzone.append('<a class="image-url" title="Add image from URL"><span class="hidden">URL</span></a>');
                }
               // if (!$dropzone.find('a.image-webcam')[0]) {
               //     $dropzone.append('<a class="image-webcam" title="Add image from webcam"><span class="hidden">Webcam</span></a>');
               // }
            },
    
            removeExtras: function () {
                $dropzone.find('span.media, div.js-upload-progress, a.image-url, a.image-upload, a.image-webcam, div.js-fail, button.js-fail, a.js-cancel').remove();
            },
    
            initWithDropzone: function () {
                var self = this;
    
                // This is the start point if no image exists
                $dropzone.find('img.js-upload-target').css({display: 'none'});
                $dropzone.find('div.description').show();
                $dropzone.removeClass('pre-image-uploader image-uploader-url').addClass('image-uploader');
                this.removeExtras();
                this.buildExtras();
                this.bindFileUpload();
                if (!settings.fileStorage) {
                    self.initUrl();
                    return;
                }
                $dropzone.find('a.image-url').on('click', function () {
                    self.initUrl();
                });
            },
            initUrl: function () {
                var self = this, val;
                this.removeExtras();
                $dropzone.addClass('image-uploader-url').removeClass('pre-image-uploader');
                $dropzone.find('.js-fileupload').addClass('right');
                if (settings.fileStorage) {
                    $dropzone.append($cancel);
                }
                $dropzone.find('.js-cancel').on('click', function () {
                    $dropzone.find('.js-url').remove();
                    $dropzone.find('.js-fileupload').removeClass('right');
                    $dropzone.trigger('imagecleared');
                    self.removeExtras();
                    self.initWithDropzone();
                });
    
                $dropzone.find('div.description').before($url);
    
                if (settings.editor) {
                    $dropzone.find('div.js-url').append('<button class="btn btn-blue js-button-accept">Save</button>');
                }
    
                $dropzone.find('.js-button-accept').on('click', function () {
                    val = $dropzone.find('.js-upload-url').val();
                    $dropzone.find('div.description').hide();
                    $dropzone.find('.js-fileupload').removeClass('right');
                    $dropzone.find('.js-url').remove();
                    if (val === '') {
                        $dropzone.trigger('uploadsuccess', 'http://');
                        self.initWithDropzone();
                    } else {
                        self.complete(val);
                    }
                });
    
                // Only show the toggle icon if there is a dropzone mode to go back to
                if (settings.fileStorage !== false) {
                    $dropzone.append('<a class="image-upload" title="Add image"><span class="hidden">Upload</span></a>');
                }
    
                $dropzone.find('a.image-upload').on('click', function () {
                    $dropzone.find('.js-url').remove();
                    $dropzone.find('.js-fileupload').removeClass('right');
                    self.initWithDropzone();
                });
            },
    
            initWithImage: function () {
                var self = this;
    
                // This is the start point if an image already exists
                $dropzone.removeClass('image-uploader image-uploader-url').addClass('pre-image-uploader');
                $dropzone.find('div.description').hide();
                $dropzone.find('img.js-upload-target').show();
                $dropzone.append($cancel);
                $dropzone.find('.js-cancel').on('click', function () {
                    $dropzone.find('img.js-upload-target').attr({src: ''});
                    $dropzone.find('div.description').show();
                    $dropzone.trigger('imagecleared');
                    $dropzone.delay(2500).animate({opacity: 100}, 1000, function () {
                        self.init();
                    });
    
                    $dropzone.trigger('uploadsuccess', 'http://');
                    self.initWithDropzone();
                });
            },
    
            init: function () {
                var imageTarget = $dropzone.find('img.js-upload-target');
                // First check if field image is defined by checking for js-upload-target class
                if (!imageTarget[0]) {
                    // This ensures there is an image we can hook into to display uploaded image
                    $dropzone.prepend('<img class="js-upload-target" style="display: none"  src="" />');
                }
                $('.js-button-accept').prop('disabled', false);
                if (imageTarget.attr('src') === '' || imageTarget.attr('src') === undefined) {
                    this.initWithDropzone();
                } else {
                    this.initWithImage();
                }
            },
    
            reset: function () {
                $dropzone.find('.js-url').remove();
                $dropzone.find('.js-fileupload').removeClass('right');
                this.removeExtras();
                this.initWithDropzone();
            }
        });
    };
    
    upload = function (options) {
        var settings = $.extend({
            progressbar: true,
            editor: false,
            fileStorage: true
        }, options);
    
        return this.each(function () {
            var $dropzone = $(this),
                ui;
    
            ui = new UploadUi($dropzone, settings);
            this.uploaderUi = ui;
            ui.init();
        });
    };
    
    __exports__["default"] = upload;
  });
define("ghost/components/gh-activating-list-item", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ActivatingListItem = Ember.Component.extend({
        tagName: 'li',
        classNameBindings: ['active'],
        active: false,
    
        unfocusLink: function () {
            this.$('a').blur();
        }.on('click')
    });
    
    __exports__["default"] = ActivatingListItem;
  });
define("ghost/components/gh-codemirror", 
  ["ghost/mixins/marker-manager","ghost/utils/codemirror-mobile","ghost/utils/set-scroll-classname","ghost/utils/codemirror-shortcuts","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    /*global CodeMirror */
    
    var MarkerManager = __dependency1__["default"];

    var mobileCodeMirror = __dependency2__["default"];

    var setScrollClassName = __dependency3__["default"];

    var codeMirrorShortcuts = __dependency4__["default"];

    
    var onChangeHandler,
        onScrollHandler,
        Codemirror;
    
    codeMirrorShortcuts.init();
    
    onChangeHandler = function (cm, changeObj) {
        var line,
            component = cm.component;
    
        // fill array with a range of numbers
        for (line = changeObj.from.line; line < changeObj.from.line + changeObj.text.length; line += 1) {
            component.checkLine.call(component, line, changeObj.origin);
        }
    
        // Is this a line which may have had a marker on it?
        component.checkMarkers.call(component);
    
        cm.component.set('value', cm.getValue());
    
        component.sendAction('typingPause');
    };
    
    onScrollHandler = function (cm) {
        var scrollInfo = cm.getScrollInfo(),
            component = cm.component;
    
        scrollInfo.codemirror = cm;
    
        // throttle scroll updates
        component.throttle = Ember.run.throttle(component, function () {
            this.set('scrollInfo', scrollInfo);
        }, 10);
    };
    
    Codemirror = Ember.TextArea.extend(MarkerManager, {
        focus: true,
        focusCursorAtEnd: false,
    
        setFocus: function () {
            if (this.get('focus')) {
                this.$().val(this.$().val()).focus();
            }
        }.on('didInsertElement'),
    
        didInsertElement: function () {
            Ember.run.scheduleOnce('afterRender', this, this.afterRenderEvent);
        },
    
        afterRenderEvent: function () {
            var self = this,
                codemirror;
    
            // replaces CodeMirror with TouchEditor only if we're on mobile
            mobileCodeMirror.createIfMobile();
    
            codemirror = this.initCodemirror();
            this.set('codemirror', codemirror);
    
            this.sendAction('setCodeMirror', this);
    
            if (this.get('focus') && this.get('focusCursorAtEnd')) {
                codemirror.execCommand('goDocEnd');
            }
    
            codemirror.eachLine(function initMarkers() {
                self.initMarkers.apply(self, arguments);
            });
        },
    
        // this needs to be placed on the 'afterRender' queue otherwise CodeMirror gets wonky
        initCodemirror: function () {
            // create codemirror
            var codemirror,
                self = this;
    
            codemirror = CodeMirror.fromTextArea(this.get('element'), {
                mode:           'gfm',
                tabMode:        'indent',
                tabindex:       '2',
                cursorScrollMargin: 10,
                lineWrapping:   true,
                dragDrop:       false,
                extraKeys: {
                    Home:   'goLineLeft',
                    End:    'goLineRight',
                    'Ctrl-U': false,
                    'Cmd-U': false,
                    'Shift-Ctrl-U': false,
                    'Shift-Cmd-U': false,
                    'Ctrl-S': false,
                    'Cmd-S': false,
                    'Ctrl-D': false,
                    'Cmd-D': false
                }
            });
    
            // Codemirror needs a reference to the component
            // so that codemirror originating events can propogate
            // up the ember action pipeline
            codemirror.component = this;
    
            // propagate changes to value property
            codemirror.on('change', onChangeHandler);
    
            // on scroll update scrollPosition property
            codemirror.on('scroll', onScrollHandler);
    
            codemirror.on('scroll', Ember.run.bind(Ember.$('.CodeMirror-scroll'), setScrollClassName, {
                target: Ember.$('.js-entry-markdown'),
                offset: 10
            }));
    
            codemirror.on('focus', function () {
                self.sendAction('onFocusIn');
            });
    
            return codemirror;
        },
    
        disableCodeMirror: function () {
            var codemirror = this.get('codemirror');
    
            codemirror.setOption('readOnly', 'nocursor');
            codemirror.off('change', onChangeHandler);
        },
    
        enableCodeMirror: function () {
            var codemirror = this.get('codemirror');
    
            codemirror.setOption('readOnly', false);
    
            // clicking the trash button on an image dropzone causes this function to fire.
            // this line is a hack to prevent multiple event handlers from being attached.
            codemirror.off('change', onChangeHandler);
    
            codemirror.on('change', onChangeHandler);
        },
    
        removeThrottle: function () {
            Ember.run.cancel(this.throttle);
        }.on('willDestroyElement'),
    
        removeCodemirrorHandlers: function () {
            // not sure if this is needed.
            var codemirror = this.get('codemirror');
            codemirror.off('change', onChangeHandler);
            codemirror.off('scroll');
        }.on('willDestroyElement'),
    
        clearMarkerManagerMarkers: function () {
            this.clearMarkers();
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = Codemirror;
  });
define("ghost/components/gh-dropdown-button", 
  ["ghost/mixins/dropdown-mixin","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DropdownMixin = __dependency1__["default"];

    
    var DropdownButton = Ember.Component.extend(DropdownMixin, {
        tagName: 'button',
    
        // matches with the dropdown this button toggles
        dropdownName: null,
    
        // Notify dropdown service this dropdown should be toggled
        click: function (event) {
            this._super(event);
            this.get('dropdown').toggleDropdown(this.get('dropdownName'), this);
        }
    });
    
    __exports__["default"] = DropdownButton;
  });
define("ghost/components/gh-dropdown", 
  ["ghost/mixins/dropdown-mixin","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DropdownMixin = __dependency1__["default"];

    
    var GhostDropdown = Ember.Component.extend(DropdownMixin, {
        classNames: 'ghost-dropdown',
        name: null,
        closeOnClick: false,
    
        // Helps track the user re-opening the menu while it's fading out.
        closing: false,
    
        // Helps track whether the dropdown is open or closes, or in a transition to either
        isOpen: false,
    
        // Managed the toggle between the fade-in and fade-out classes
        fadeIn: Ember.computed('isOpen', 'closing', function () {
            return this.get('isOpen') && !this.get('closing');
        }),
    
        classNameBindings: ['fadeIn:fade-in-scale:fade-out', 'isOpen:open:closed'],
    
        open: function () {
            this.set('isOpen', true);
            this.set('closing', false);
            this.set('button.isOpen', true);
        },
    
        close: function () {
            var self = this;
    
            this.set('closing', true);
    
            if (this.get('button')) {
                this.set('button.isOpen', false);
            }
            this.$().on('animationend webkitAnimationEnd oanimationend MSAnimationEnd', function (event) {
                if (event.originalEvent.animationName === 'fade-out') {
                    if (self.get('closing')) {
                        self.set('isOpen', false);
                        self.set('closing', false);
                    }
                }
            });
        },
    
        // Called by the dropdown service when any dropdown button is clicked.
        toggle: function (options) {
            var isClosing = this.get('closing'),
                isOpen = this.get('isOpen'),
                name = this.get('name'),
                button = this.get('button'),
                targetDropdownName = options.target;
    
            if (name === targetDropdownName && (!isOpen || isClosing)) {
                if (!button) {
                    button = options.button;
                    this.set('button', button);
                }
                this.open();
            } else if (isOpen) {
                this.close();
            }
        },
    
        click: function (event) {
            this._super(event);
    
            if (this.get('closeOnClick')) {
                return this.close();
            }
        },
    
        didInsertElement: function () {
            this._super();
    
            var dropdownService = this.get('dropdown');
    
            dropdownService.on('close', this, this.close);
            dropdownService.on('toggle', this, this.toggle);
        },
    
        willDestroyElement: function () {
            this._super();
    
            var dropdownService = this.get('dropdown');
    
            dropdownService.off('close', this, this.close);
            dropdownService.off('toggle', this, this.toggle);
        }
    });
    
    __exports__["default"] = GhostDropdown;
  });
define("ghost/components/gh-file-upload", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var FileUpload = Ember.Component.extend({
        _file: null,
    
        uploadButtonText: 'Text',
    
        uploadButtonDisabled: true,
    
        change: function (event) {
            this.set('uploadButtonDisabled', false);
            this.sendAction('onAdd');
            this._file = event.target.files[0];
        },
    
        onUpload: 'onUpload',
    
        actions: {
            upload: function () {
                if (!this.uploadButtonDisabled && this._file) {
                    this.sendAction('onUpload', this._file);
                }
    
                // Prevent double post by disabling the button.
                this.set('uploadButtonDisabled', true);
            }
        }
    });
    
    __exports__["default"] = FileUpload;
  });
define("ghost/components/gh-form", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var Form = Ember.View.extend({
        tagName: 'form',
        attributeBindings: ['enctype'],
        reset: function () {
            this.$().get(0).reset();
        },
        didInsertElement: function () {
            this.get('controller').on('reset', this, this.reset);
        },
        willClearRender: function () {
            this.get('controller').off('reset', this, this.reset);
        }
    });
    
    __exports__["default"] = Form;
  });
define("ghost/components/gh-input", 
  ["ghost/mixins/text-input","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var TextInputMixin = __dependency1__["default"];

    
    var Input = Ember.TextField.extend(TextInputMixin);
    
    __exports__["default"] = Input;
  });
define("ghost/components/gh-markdown", 
  ["ghost/assets/lib/uploader","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var uploader = __dependency1__["default"];

    
    var Markdown = Ember.Component.extend({
        didInsertElement: function () {
            this.set('scrollWrapper', this.$().closest('.entry-preview-content'));
        },
    
        adjustScrollPosition: function () {
            var scrollWrapper = this.get('scrollWrapper'),
                scrollPosition = this.get('scrollPosition');
    
            scrollWrapper.scrollTop(scrollPosition);
        }.observes('scrollPosition'),
    
        // fire off 'enable' API function from uploadManager
        // might need to make sure markdown has been processed first
        reInitDropzones: function () {
            function handleDropzoneEvents() {
                var dropzones = $('.js-drop-zone');
    
                uploader.call(dropzones, {
                    editor: true,
                    fileStorage: this.get('config.fileStorage')
                });
    
                dropzones.on('uploadstart', Ember.run.bind(this, 'sendAction', 'uploadStarted'));
                dropzones.on('uploadfailure', Ember.run.bind(this, 'sendAction', 'uploadFinished'));
                dropzones.on('uploadsuccess', Ember.run.bind(this, 'sendAction', 'uploadFinished'));
                dropzones.on('uploadsuccess', Ember.run.bind(this, 'sendAction', 'uploadSuccess'));
            }
    
            Ember.run.scheduleOnce('afterRender', this, handleDropzoneEvents);
        }.observes('markdown')
    });
    
    __exports__["default"] = Markdown;
  });
define("ghost/components/gh-modal-dialog", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ModalDialog = Ember.Component.extend({
        didInsertElement: function () {
            this.$('.js-modal-container, .js-modal-background').addClass('fade-in open');
            this.$('.js-modal').addClass('open');
        },
    
        close: function () {
            var self = this;
    
            this.$('.js-modal, .js-modal-background').removeClass('fade-in').addClass('fade-out');
    
            // The background should always be the last thing to fade out, so check on that instead of the content
            this.$('.js-modal-background').on('animationend webkitAnimationEnd oanimationend MSAnimationEnd', function (event) {
                if (event.originalEvent.animationName === 'fade-out') {
                    self.$('.js-modal, .js-modal-background').removeClass('open');
                }
            });
    
            this.sendAction();
        },
    
        confirmaccept: 'confirmAccept',
        confirmreject: 'confirmReject',
    
        actions: {
            closeModal: function () {
                this.close();
            },
            confirm: function (type) {
                this.sendAction('confirm' + type);
                this.close();
            },
            noBubble: Ember.K
        },
    
        klass: Ember.computed('type', 'style', function () {
            var classNames = [];
    
            classNames.push(this.get('type') ? 'modal-' + this.get('type') : 'modal');
    
            if (this.get('style')) {
                this.get('style').split(',').forEach(function (style) {
                    classNames.push('modal-style-' + style);
                });
            }
    
            return classNames.join(' ');
        }),
    
        acceptButtonClass: Ember.computed('confirm.accept.buttonClass', function () {
            return this.get('confirm.accept.buttonClass') ? this.get('confirm.accept.buttonClass') : 'btn btn-green';
        }),
    
        rejectButtonClass: Ember.computed('confirm.reject.buttonClass', function () {
            return this.get('confirm.reject.buttonClass') ? this.get('confirm.reject.buttonClass') : 'btn btn-red';
        })
    });
    
    __exports__["default"] = ModalDialog;
  });
define("ghost/components/gh-navitem-url-input", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function joinUrlParts(url, path) {
        if (path[0] !== '/' && url.slice(-1) !== '/') {
            path = '/' + path;
        } else if (path[0] === '/' && url.slice(-1) === '/') {
            path = path.slice(1);
        }
    
        return url + path;
    }
    
    var NavItemUrlInputComponent = Ember.TextField.extend({
        classNameBindings: ['fakePlaceholder'],
    
        isBaseUrl: Ember.computed('baseUrl', 'value', function () {
            return this.get('baseUrl') === this.get('value');
        }),
    
        fakePlaceholder: Ember.computed('isBaseUrl', 'hasFocus', function () {
            return this.get('isBaseUrl') && !this.get('hasFocus');
        }),
    
        isRelative: Ember.computed('value', function () {
            return !validator.isURL(this.get('value'));
        }),
    
        didInsertElement: function () {
            var url = this.get('url'),
                baseUrl = this.get('baseUrl');
    
            this.set('value', url);
    
            // if we have a relative url, create the absolute url to be displayed in the input
            if (this.get('isRelative')) {
                url = joinUrlParts(baseUrl, url);
                this.set('value', url);
            }
        },
    
        focusIn: function (event) {
            this.set('hasFocus', true);
    
            if (this.get('isBaseUrl')) {
                // position the cursor at the end of the input
                Ember.run.next(function (el) {
                    var length = el.value.length;
    
                    el.setSelectionRange(length, length);
                }, event.target);
            }
        },
    
        keyDown: function (event) {
            // delete the "placeholder" value all at once
            if (this.get('isBaseUrl') && (event.keyCode === 8 || event.keyCode === 46)) {
                this.set('value', '');
    
                event.preventDefault();
            }
        },
    
        keyPress: function (event) {
            // enter key
            if (event.keyCode === 13) {
                event.preventDefault();
                this.notifyUrlChanged();
            }
    
            return true;
        },
    
        focusOut: function () {
            this.set('hasFocus', false);
    
            this.notifyUrlChanged();
        },
    
        notifyUrlChanged: function () {
            this.set('value', this.get('value').trim());
    
            var url = this.get('value'),
                baseUrl = this.get('baseUrl');
    
            if (this.get('isRelative')) {
                this.set('value', joinUrlParts(baseUrl, url));
            }
    
            this.sendAction('change', url);
        }
    });
    
    __exports__["default"] = NavItemUrlInputComponent;
  });
define("ghost/components/gh-navitem", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NavItemComponent = Ember.Component.extend({
        classNames: 'navigation-item',
    
        attributeBindings: ['order:data-order'],
        order: Ember.computed.readOnly('navItem.order'),
    
        keyPress: function (event) {
            // enter key
            if (event.keyCode === 13) {
                event.preventDefault();
                this.get('controller').send('addItem');
            }
        },
    
        actions: {
            addItem: function () {
                this.sendAction('addItem');
            },
    
            deleteItem: function (item) {
                this.sendAction('deleteItem', item);
            },
    
            updateUrl: function (value) {
                this.sendAction('updateUrl', value, this.get('navItem'));
            }
        }
    });
    
    __exports__["default"] = NavItemComponent;
  });
define("ghost/components/gh-notification", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NotificationComponent = Ember.Component.extend({
        classNames: ['js-bb-notification'],
    
        typeClass: Ember.computed(function () {
            var classes = '',
                message = this.get('message'),
                type,
                dismissible;
    
            // Check to see if we're working with a DS.Model or a plain JS object
            if (typeof message.toJSON === 'function') {
                type = message.get('type');
                dismissible = message.get('dismissible');
            } else {
                type = message.type;
                dismissible = message.dismissible;
            }
    
            classes += 'notification-' + type;
    
            if (type === 'success' && dismissible !== false) {
                classes += ' notification-passive';
            }
    
            return classes;
        }),
    
        didInsertElement: function () {
            var self = this;
    
            self.$().on('animationend webkitAnimationEnd oanimationend MSAnimationEnd', function (event) {
                if (event.originalEvent.animationName === 'fade-out') {
                    self.notifications.removeObject(self.get('message'));
                }
            });
        },
    
        actions: {
            closeNotification: function () {
                var self = this;
                self.notifications.closeNotification(self.get('message'));
            }
        }
    });
    
    __exports__["default"] = NotificationComponent;
  });
define("ghost/components/gh-notifications", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NotificationsComponent = Ember.Component.extend({
        tagName: 'aside',
        classNames: 'notifications',
        classNameBindings: ['location'],
    
        messages: Ember.computed.filter('notifications', function (notification) {
            // If this instance of the notifications component has no location affinity
            // then it gets all notifications
            if (!this.get('location')) {
                return true;
            }
    
            var displayLocation = (typeof notification.toJSON === 'function') ?
                notification.get('location') : notification.location;
    
            return this.get('location') === displayLocation;
        }),
    
        messageCountObserver: function () {
            this.sendAction('notify', this.get('messages').length);
        }.observes('messages.[]')
    });
    
    __exports__["default"] = NotificationsComponent;
  });
define("ghost/components/gh-popover-button", 
  ["ghost/components/gh-dropdown-button","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DropdownButton = __dependency1__["default"];

    
    var PopoverButton = DropdownButton.extend({
        click: Ember.K, // We don't want clicks on popovers, but dropdowns have them. So `K`ill them here.
    
        mouseEnter: function (event) {
            this._super(event);
            this.get('dropdown').toggleDropdown(this.get('popoverName'), this);
        },
    
        mouseLeave: function (event) {
            this._super(event);
            this.get('dropdown').toggleDropdown(this.get('popoverName'), this);
        }
    });
    
    __exports__["default"] = PopoverButton;
  });
define("ghost/components/gh-popover", 
  ["ghost/components/gh-dropdown","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var GhostDropdown = __dependency1__["default"];

    
    var GhostPopover = GhostDropdown.extend({
        classNames: 'ghost-popover'
    });
    
    __exports__["default"] = GhostPopover;
  });
define("ghost/components/gh-role-selector", 
  ["ghost/components/gh-select","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var GhostSelect = __dependency1__["default"];

    
    var RolesSelector = GhostSelect.extend({
        roles: Ember.computed.alias('options'),
    
        options: Ember.computed(function () {
            var rolesPromise = this.store.find('role', {permissions: 'assign'});
    
            return Ember.ArrayProxy.extend(Ember.PromiseProxyMixin)
                .create({promise: rolesPromise});
        })
    });
    
    __exports__["default"] = RolesSelector;
  });
define("ghost/components/gh-select", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // GhostSelect is a solution to Ember.Select being evil and worthless.
    // (Namely, this solves problems with async data in Ember.Select)
    // Inspired by (that is, totally ripped off from) this JSBin
    // http://emberjs.jsbin.com/rwjblue/40/edit
    
    // Usage:
    // Extend this component and create a template for your component.
    // Your component must define the `options` property.
    // Optionally use `initialValue` to set the object
    //     you want to have selected to start with.
    // Both options and initalValue are promise safe.
    // Set onChange in your template to be the name
    //    of the action you want called in your
    // For an example, see gh-roles-selector
    
    var GhostSelect = Ember.Component.extend({
        tagName: 'span',
        classNames: ['gh-select'],
        attributeBindings: ['tabindex'],
    
        tabindex: '0', // 0 must be a string, or else it's interpreted as false
    
        options: null,
        initialValue: null,
    
        resolvedOptions: null,
        resolvedInitialValue: null,
    
        // Convert promises to their values
        init: function () {
            var self = this;
    
            this._super.apply(this, arguments);
    
            Ember.RSVP.hash({
                resolvedOptions: this.get('options'),
                resolvedInitialValue: this.get('initialValue')
            }).then(function (resolvedHash) {
                self.setProperties(resolvedHash);
    
                // Run after render to ensure the <option>s have rendered
                Ember.run.schedule('afterRender', function () {
                    self.setInitialValue();
                });
            });
        },
    
        setInitialValue: function () {
            var initialValue = this.get('resolvedInitialValue'),
                options = this.get('resolvedOptions'),
                initialValueIndex = options.indexOf(initialValue);
    
            if (initialValueIndex > -1) {
                this.$('option:eq(' + initialValueIndex + ')').prop('selected', true);
            }
        },
    
        // Called by DOM events
        change: function () {
            this._changeSelection();
        },
    
        // Send value to specified action
        _changeSelection: function () {
            var value = this._selectedValue();
    
            Ember.set(this, 'value', value);
            this.sendAction('onChange', value);
        },
    
        _selectedValue: function () {
            var selectedIndex = this.$('select')[0].selectedIndex;
    
            return this.get('options').objectAt(selectedIndex);
        }
    });
    
    __exports__["default"] = GhostSelect;
  });
define("ghost/components/gh-tab-pane", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // See gh-tabs-manager.js for use
    var TabPane = Ember.Component.extend({
        classNameBindings: ['active'],
    
        tabsManager: Ember.computed(function () {
            return this.nearestWithProperty('isTabsManager');
        }),
    
        tab: Ember.computed('tabsManager.tabs.[]', 'tabsManager.tabPanes.[]', function () {
            var index = this.get('tabsManager.tabPanes').indexOf(this),
                tabs = this.get('tabsManager.tabs');
    
            return tabs && tabs.objectAt(index);
        }),
    
        active: Ember.computed.alias('tab.active'),
    
        // Register with the tabs manager
        registerWithTabs: function () {
            this.get('tabsManager').registerTabPane(this);
        }.on('didInsertElement'),
    
        unregisterWithTabs: function () {
            this.get('tabsManager').unregisterTabPane(this);
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = TabPane;
  });
define("ghost/components/gh-tab", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // See gh-tabs-manager.js for use
    var Tab = Ember.Component.extend({
        tabsManager: Ember.computed(function () {
            return this.nearestWithProperty('isTabsManager');
        }),
    
        active: Ember.computed('tabsManager.activeTab', function () {
            return this.get('tabsManager.activeTab') === this;
        }),
    
        index: Ember.computed('tabsManager.tabs.@each', function () {
            return this.get('tabsManager.tabs').indexOf(this);
        }),
    
        // Select on click
        click: function () {
            this.get('tabsManager').select(this);
        },
    
        // Registration methods
        registerWithTabs: function () {
            this.get('tabsManager').registerTab(this);
        }.on('didInsertElement'),
    
        unregisterWithTabs: function () {
            this.get('tabsManager').unregisterTab(this);
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = Tab;
  });
define("ghost/components/gh-tabs-manager", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
    Heavily inspired by ic-tabs (https://github.com/instructure/ic-tabs)
    
    Three components work together for smooth tabbing.
    1. tabs-manager (gh-tabs)
    2. tab (gh-tab)
    3. tab-pane (gh-tab-pane)
    
    ## Usage:
    The tabs-manager must wrap all tab and tab-pane components,
    but they can be nested at any level.
    
    A tab and its pane are tied together via their order.
    So, the second tab within a tab manager will activate
    the second pane within that manager.
    
    ```hbs
    {{#gh-tabs-manager}}
      {{#gh-tab}}
        First tab
      {{/gh-tab}}
      {{#gh-tab}}
        Second tab
      {{/gh-tab}}
    
      ....
      {{#gh-tab-pane}}
        First pane
      {{/gh-tab-pane}}
      {{#gh-tab-pane}}
        Second pane
      {{/gh-tab-pane}}
    {{/gh-tabs-manager}}
    ```
    ## Options:
    
    the tabs-manager will send a "selected" action whenever one of its
    tabs is clicked.
    ```hbs
    {{#gh-tabs-manager selected="myAction"}}
        ....
    {{/gh-tabs-manager}}
    ```
    
    ## Styling:
    Both tab and tab-pane elements have an "active"
    class applied when they are active.
    
    */
    var TabsManager = Ember.Component.extend({
        activeTab: null,
        tabs: [],
        tabPanes: [],
    
        // Called when a gh-tab is clicked.
        select: function (tab) {
            this.set('activeTab', tab);
            this.sendAction('selected');
        },
    
        // Used by children to find this tabsManager
        isTabsManager: true,
    
        // Register tabs and their panes to allow for
        // interaction between components.
        registerTab: function (tab) {
            this.get('tabs').addObject(tab);
        },
    
        unregisterTab: function (tab) {
            this.get('tabs').removeObject(tab);
        },
    
        registerTabPane: function (tabPane) {
            this.get('tabPanes').addObject(tabPane);
        },
    
        unregisterTabPane: function (tabPane) {
            this.get('tabPanes').removeObject(tabPane);
        }
    });
    
    __exports__["default"] = TabsManager;
  });
define("ghost/components/gh-textarea", 
  ["ghost/mixins/text-input","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var TextInputMixin = __dependency1__["default"];

    
    var TextArea = Ember.TextArea.extend(TextInputMixin);
    
    __exports__["default"] = TextArea;
  });
define("ghost/components/gh-trim-focus-input", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*global device*/
    var TrimFocusInput = Ember.TextField.extend({
        focus: true,
    
        attributeBindings: ['autofocus'],
    
        autofocus: Ember.computed(function () {
            if (this.get('focus')) {
                return (device.ios()) ? false : 'autofocus';
            }
    
            return false;
        }),
    
        didInsertElement: function () {
            // This fix is required until Mobile Safari has reliable
            // autofocus, select() or focus() support
            if (this.get('focus') && !device.ios()) {
                this.$().val(this.$().val()).focus();
            }
        },
    
        focusOut: function () {
            var text = this.$().val();
    
            this.$().val(text.trim());
        }
    });
    
    __exports__["default"] = TrimFocusInput;
  });
define("ghost/components/gh-upload-modal", 
  ["ghost/components/gh-modal-dialog","ghost/assets/lib/uploader","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ModalDialog = __dependency1__["default"];

    var upload = __dependency2__["default"];

    
    var UploadModal = ModalDialog.extend({
        layoutName: 'components/gh-modal-dialog',
    
        didInsertElement: function () {
            this._super();
            upload.call(this.$('.js-drop-zone'), {fileStorage: this.get('config.fileStorage')});
        },
        confirm: {
            reject: {
                func: function () { // The function called on rejection
                    return true;
                },
                buttonClass: 'btn btn-default',
                text: 'Cancel' // The reject button text
            },
            accept: {
                buttonClass: 'btn btn-blue right',
                text: 'Save', // The accept button texttext: 'Save'
                func: function () {
                    var imageType = 'model.' + this.get('imageType');
    
                    if (this.$('.js-upload-url').val()) {
                        this.set(imageType, this.$('.js-upload-url').val());
                    } else {
                        this.set(imageType, this.$('.js-upload-target').attr('src'));
                    }
                    return true;
                }
            }
        },
    
        actions: {
            closeModal: function () {
                this.sendAction();
            },
            confirm: function (type) {
                var func = this.get('confirm.' + type + '.func');
                if (typeof func === 'function') {
                    func.apply(this);
                }
                this.sendAction();
                this.sendAction('confirm' + type);
            }
        }
    });
    
    __exports__["default"] = UploadModal;
  });
define("ghost/components/gh-uploader", 
  ["ghost/assets/lib/uploader","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var uploader = __dependency1__["default"];

    
    var PostImageUploader = Ember.Component.extend({
        classNames: ['image-uploader', 'js-post-image-upload'],
    
        imageSource: Ember.computed('image', function () {
            return this.get('image') || '';
        }),
    
        setup: function () {
            var $this = this.$(),
                self = this;
    
            this.set('uploaderReference', uploader.call($this, {
                editor: true,
                fileStorage: this.get('config.fileStorage')
            }));
    
            $this.on('uploadsuccess', function (event, result) {
                if (result && result !== '' && result !== 'http://') {
                    self.sendAction('uploaded', result);
                }
            });
    
            $this.on('imagecleared', function () {
                self.sendAction('canceled');
            });
        }.on('didInsertElement'),
    
        removeListeners: function () {
            var $this = this.$();
    
            $this.off();
            $this.find('.js-cancel').off();
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = PostImageUploader;
  });
define("ghost/components/gh-url-preview", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*
    Example usage:
    {{gh-url-preview prefix="tag" slug=theSlugValue tagName="p" classNames="description"}}
    */
    var urlPreview = Ember.Component.extend({
        classNames: 'ghost-url-preview',
        prefix: null,
        slug: null,
    
        url: Ember.computed('slug', function () {
            // Get the blog URL and strip the scheme
            var blogUrl = this.get('config').blogUrl,
                noSchemeBlogUrl = blogUrl.substr(blogUrl.indexOf('://') + 3), // Remove `http[s]://`
    
                // Get the prefix and slug values
                prefix = this.get('prefix') ? this.get('prefix') + '/' : '',
                slug = this.get('slug') ? this.get('slug') + '/' : '',
    
                // Join parts of the URL together with slashes
                theUrl = noSchemeBlogUrl + '/' + prefix + slug;
    
            return theUrl;
        })
    });
    
    __exports__["default"] = urlPreview;
  });
define("ghost/config", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function configureApp(App) {
        if (!App instanceof Ember.Application) {
            return;
        }
    }
    
    __exports__["default"] = configureApp;
  });
define("ghost/controllers/application", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ApplicationController = Ember.Controller.extend({
        // jscs: disable
        hideNav: Ember.computed.match('currentPath', /(error|signin|signup|setup|forgotten|reset)/),
        // jscs: enable
    
        topNotificationCount: 0,
        showGlobalMobileNav: false,
        showSettingsMenu: false,
    
        userImage: Ember.computed('session.user.image', function () {
            return this.get('session.user.image') || this.get('ghostPaths.url').asset('/shared/img/user-image.png');
        }),
    
        userImageBackground: Ember.computed('userImage', function () {
            return 'background-image: url(' + this.get('userImage') + ')';
        }),
    
        userImageAlt: Ember.computed('session.user.name', function () {
            var name = this.get('session.user.name');
    
            return (name) ? name + '\'s profile picture' : 'Profile picture';
        }),
    
        actions: {
            topNotificationChange: function (count) {
                this.set('topNotificationCount', count);
            }
        }
    });
    
    __exports__["default"] = ApplicationController;
  });
define("ghost/controllers/editor/edit", 
  ["ghost/mixins/editor-base-controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EditorControllerMixin = __dependency1__["default"];

    
    var EditorEditController = Ember.Controller.extend(EditorControllerMixin);
    
    __exports__["default"] = EditorEditController;
  });
define("ghost/controllers/editor/new", 
  ["ghost/mixins/editor-base-controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EditorControllerMixin = __dependency1__["default"];

    
    var EditorNewController = Ember.Controller.extend(EditorControllerMixin, {
        actions: {
            /**
              * Redirect to editor after the first save
              */
            save: function (options) {
                var self = this;
                return this._super(options).then(function (model) {
                    if (model.get('id')) {
                        self.replaceRoute('editor.edit', model);
                    }
                });
            }
        }
    });
    
    __exports__["default"] = EditorNewController;
  });
define("ghost/controllers/error", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ErrorController = Ember.Controller.extend({
        code: Ember.computed('content.status', function () {
            return this.get('content.status') > 200 ? this.get('content.status') : 500;
        }),
        message: Ember.computed('content.statusText', function () {
            if (this.get('code') === 404) {
                return 'No Ghost Found';
            }
    
            return this.get('content.statusText') !== 'error' ? this.get('content.statusText') : 'Internal Server Error';
        }),
        stack: false
    });
    
    __exports__["default"] = ErrorController;
  });
define("ghost/controllers/feature", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var FeatureController = Ember.Controller.extend(Ember.PromiseProxyMixin, {
        init: function () {
            var promise;
    
            promise = this.store.find('setting', {type: 'blog,theme'}).then(function (settings) {
                return settings.get('firstObject');
            });
    
            this.set('promise', promise);
        },
    
        setting: Ember.computed.alias('content'),
    
        labs: Ember.computed('isSettled', 'setting.labs', function () {
            var value = {};
    
            if (this.get('isFulfilled')) {
                try {
                    value = JSON.parse(this.get('setting.labs') || {});
                } catch (err) {
                    value = {};
                }
            }
    
            return value;
        }),
    
        codeInjectionUI: Ember.computed('config.codeInjectionUI', 'labs.codeInjectionUI', function () {
            return this.get('config.codeInjectionUI') || this.get('labs.codeInjectionUI');
        })
    });
    
    __exports__["default"] = FeatureController;
  });
define("ghost/controllers/forgotten", 
  ["ghost/utils/ajax","ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ajax = __dependency1__["default"];

    var ValidationEngine = __dependency2__["default"];

    
    var ForgottenController = Ember.Controller.extend(ValidationEngine, {
        email: '',
        submitting: false,
    
        // ValidationEngine settings
        validationType: 'forgotten',
    
        actions: {
            submit: function () {
                var self = this,
                    data = self.getProperties('email');
    
                this.toggleProperty('submitting');
                this.validate({format: false}).then(function () {
                    ajax({
                        url: self.get('ghostPaths.url').api('authentication', 'passwordreset'),
                        type: 'POST',
                        data: {
                            passwordreset: [{
                                email: data.email
                            }]
                        }
                    }).then(function () {
                        self.toggleProperty('submitting');
                        self.notifications.showSuccess('Please check your email for instructions.', {delayed: true});
                        self.set('email', '');
                        self.transitionToRoute('signin');
                    }).catch(function (resp) {
                        self.toggleProperty('submitting');
                        self.notifications.showAPIError(resp, {defaultErrorText: 'There was a problem with the reset, please try again.'});
                    });
                }).catch(function (errors) {
                    self.toggleProperty('submitting');
                    self.notifications.showErrors(errors);
                });
            }
        }
    });
    
    __exports__["default"] = ForgottenController;
  });
define("ghost/controllers/modals/copy-html", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var CopyHTMLController = Ember.Controller.extend({
    
        generatedHTML: Ember.computed.alias('model.generatedHTML')
    
    });
    
    __exports__["default"] = CopyHTMLController;
  });
define("ghost/controllers/modals/delete-all", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var DeleteAllController = Ember.Controller.extend({
        actions: {
            confirmAccept: function () {
                var self = this;
    
                ic.ajax.request(this.get('ghostPaths.url').api('db'), {
                    type: 'DELETE'
                }).then(function () {
                    self.notifications.showSuccess('All content deleted from database.');
                    self.store.unloadAll('post');
                    self.store.unloadAll('tag');
                }).catch(function (response) {
                    self.notifications.showErrors(response);
                });
            },
    
            confirmReject: function () {
                return false;
            }
        },
    
        confirm: {
            accept: {
                text: 'Delete',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Cancel',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = DeleteAllController;
  });
define("ghost/controllers/modals/delete-post", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var DeletePostController = Ember.Controller.extend({
        actions: {
            confirmAccept: function () {
                var self = this,
                    model = this.get('model');
    
                // definitely want to clear the data store and post of any unsaved, client-generated tags
                model.updateTags();
    
                model.destroyRecord().then(function () {
                    self.get('dropdown').closeDropdowns();
                    self.transitionToRoute('posts.index');
                    self.notifications.showSuccess('Your post has been deleted.', {delayed: true});
                }, function () {
                    self.notifications.showError('Your post could not be deleted. Please try again.');
                });
            },
    
            confirmReject: function () {
                return false;
            }
        },
    
        confirm: {
            accept: {
                text: 'Delete',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Cancel',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = DeletePostController;
  });
define("ghost/controllers/modals/delete-tag", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var DeleteTagController = Ember.Controller.extend({
        postInflection: Ember.computed('model.post_count', function () {
            return this.get('model.post_count') > 1 ? 'posts' : 'post';
        }),
    
        actions: {
            confirmAccept: function () {
                var tag = this.get('model'),
                    name = tag.get('name'),
                    self = this;
    
                this.send('closeSettingsMenu');
    
                tag.destroyRecord().then(function () {
                    self.notifications.showSuccess('Deleted ' + name);
                }).catch(function (error) {
                    self.notifications.showAPIError(error);
                });
            },
    
            confirmReject: function () {
                return false;
            }
        },
    
        confirm: {
            accept: {
                text: 'Delete',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Cancel',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = DeleteTagController;
  });
define("ghost/controllers/modals/delete-user", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var DeleteUserController = Ember.Controller.extend({
        userPostCount: Ember.computed('model.id', function () {
            var promise,
                query = {
                    author: this.get('model.slug'),
                    status: 'all'
                };
    
            promise = this.store.find('post', query).then(function (results) {
                return results.meta.pagination.total;
            });
    
            return Ember.Object.extend(Ember.PromiseProxyMixin, {
                count: Ember.computed.alias('content'),
    
                inflection: Ember.computed('count', function () {
                    return this.get('count') > 1 ? 'posts' : 'post';
                })
            }).create({promise: promise});
        }),
    
        actions: {
            confirmAccept: function () {
                var self = this,
                    user = this.get('model');
    
                user.destroyRecord().then(function () {
                    self.store.unloadAll('post');
                    self.transitionToRoute('settings.users');
                    self.notifications.showSuccess('The user has been deleted.', {delayed: true});
                }, function () {
                    self.notifications.showError('The user could not be deleted. Please try again.');
                });
            },
    
            confirmReject: function () {
                return false;
            }
        },
    
        confirm: {
            accept: {
                text: 'Delete User',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Cancel',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = DeleteUserController;
  });
define("ghost/controllers/modals/invite-new-user", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var InviteNewUserController = Ember.Controller.extend({
        // Used to set the initial value for the dropdown
        authorRole: Ember.computed(function () {
            var self = this;
    
            return this.store.find('role').then(function (roles) {
                var authorRole = roles.findBy('name', 'Author');
    
                // Initialize role as well.
                self.set('role', authorRole);
                self.set('authorRole', authorRole);
    
                return authorRole;
            });
        }),
    
        confirm: {
            accept: {
                text: 'send invitation now'
            },
            reject: {
                buttonClass: 'hidden'
            }
        },
    
        actions: {
            setRole: function (role) {
                this.set('role', role);
            },
    
            confirmAccept: function () {
                var email = this.get('email'),
                    role = this.get('role'),
                    self = this,
                    newUser;
    
                // reset the form and close the modal
                self.set('email', '');
                self.set('role', self.get('authorRole'));
                self.send('closeModal');
    
                this.store.find('user').then(function (result) {
                    var invitedUser = result.findBy('email', email);
    
                    if (invitedUser) {
                        if (invitedUser.get('status') === 'invited' || invitedUser.get('status') === 'invited-pending') {
                            self.notifications.showWarn('A user with that email address was already invited.');
                        } else {
                            self.notifications.showWarn('A user with that email address already exists.');
                        }
                    } else {
                        newUser = self.store.createRecord('user', {
                            email: email,
                            status: 'invited',
                            role: role
                        });
    
                        newUser.save().then(function () {
                            var notificationText = 'Invitation sent! (' + email + ')';
    
                            // If sending the invitation email fails, the API will still return a status of 201
                            // but the user's status in the response object will be 'invited-pending'.
                            if (newUser.get('status') === 'invited-pending') {
                                self.notifications.showWarn('Invitation email was not sent.  Please try resending.');
                            } else {
                                self.notifications.showSuccess(notificationText);
                            }
                        }).catch(function (errors) {
                            newUser.deleteRecord();
                            self.notifications.showErrors(errors);
                        });
                    }
                });
            },
    
            confirmReject: function () {
                return false;
            }
        }
    });
    
    __exports__["default"] = InviteNewUserController;
  });
define("ghost/controllers/modals/leave-editor", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var LeaveEditorController = Ember.Controller.extend({
        args: Ember.computed.alias('model'),
    
        actions: {
            confirmAccept: function () {
                var args = this.get('args'),
                    editorController,
                    model,
                    transition;
    
                if (Ember.isArray(args)) {
                    editorController = args[0];
                    transition = args[1];
                    model = editorController.get('model');
                }
    
                if (!transition || !editorController) {
                    this.notifications.showError('Sorry, there was an error in the application. Please let the Ghost team know what happened.');
    
                    return true;
                }
    
                // definitely want to clear the data store and post of any unsaved, client-generated tags
                model.updateTags();
    
                if (model.get('isNew')) {
                    // the user doesn't want to save the new, unsaved post, so delete it.
                    model.deleteRecord();
                } else {
                    // roll back changes on model props
                    model.rollback();
                }
    
                // setting isDirty to false here allows willTransition on the editor route to succeed
                editorController.set('isDirty', false);
    
                // since the transition is now certain to complete, we can unset window.onbeforeunload here
                window.onbeforeunload = null;
    
                transition.retry();
            },
    
            confirmReject: function () {
            }
        },
    
        confirm: {
            accept: {
                text: 'Leave',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Stay',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = LeaveEditorController;
  });
define("ghost/controllers/modals/signin", 
  ["ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    
    __exports__["default"] = Ember.Controller.extend(SimpleAuth.AuthenticationControllerMixin, ValidationEngine, {
        needs: 'application',
    
        authenticator: 'simple-auth-authenticator:oauth2-password-grant',
    
        validationType: 'signin',
    
        identification: Ember.computed('session.user.email', function () {
            return this.get('session.user.email');
        }),
    
        actions: {
            authenticate: function () {
                var appController = this.get('controllers.application'),
                    self = this;
    
                appController.set('skipAuthSuccessHandler', true);
    
                this._super(this.getProperties('identification', 'password')).then(function () {
                    self.send('closeModal');
                    self.notifications.showSuccess('Login successful.');
                    self.set('password', '');
                }).catch(function () {
                    // if authentication fails a rejected promise will be returned.
                    // it needs to be caught so it doesn't generate an exception in the console,
                    // but it's actually "handled" by the sessionAuthenticationFailed action handler.
                }).finally(function () {
                    appController.set('skipAuthSuccessHandler', undefined);
                });
            },
    
            validateAndAuthenticate: function () {
                var self = this;
    
                // Manually trigger events for input fields, ensuring legacy compatibility with
                // browsers and password managers that don't send proper events on autofill
                $('#login').find('input').trigger('change');
    
                this.validate({format: false}).then(function () {
                    self.notifications.closePassive();
                    self.send('authenticate');
                }).catch(function (errors) {
                    self.notifications.showErrors(errors);
                });
            },
    
            confirmAccept: function () {
                this.send('validateAndAuthenticate');
            }
        }
    });
  });
define("ghost/controllers/modals/transfer-owner", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var TransferOwnerController = Ember.Controller.extend({
        actions: {
            confirmAccept: function () {
                var user = this.get('model'),
                    url = this.get('ghostPaths.url').api('users', 'owner'),
                    self = this;
    
                self.get('dropdown').closeDropdowns();
    
                ic.ajax.request(url, {
                    type: 'PUT',
                    data: {
                        owner: [{
                            id: user.get('id')
                        }]
                    }
                }).then(function (response) {
                    // manually update the roles for the users that just changed roles
                    // because store.pushPayload is not working with embedded relations
                    if (response && Ember.isArray(response.users)) {
                        response.users.forEach(function (userJSON) {
                            var user = self.store.getById('user', userJSON.id),
                                role = self.store.getById('role', userJSON.roles[0].id);
    
                            user.set('role', role);
                        });
                    }
    
                    self.notifications.showSuccess('Ownership successfully transferred to ' + user.get('name'));
                }).catch(function (error) {
                    self.notifications.showAPIError(error);
                });
            },
    
            confirmReject: function () {
                return false;
            }
        },
    
        confirm: {
            accept: {
                text: 'Yep - I\'m sure',
                buttonClass: 'btn btn-red'
            },
            reject: {
                text: 'Cancel',
                buttonClass: 'btn btn-default btn-minor'
            }
        }
    });
    
    __exports__["default"] = TransferOwnerController;
  });
define("ghost/controllers/modals/upload", 
  ["exports"],
  function(__exports__) {
    "use strict";
    
    var UploadController = Ember.Controller.extend({
        acceptEncoding: 'image/*',
        actions: {
            confirmAccept: function () {
                var self = this;
    
                this.get('model').save().then(function (model) {
                    self.notifications.showSuccess('Saved');
                    return model;
                }).catch(function (err) {
                    self.notifications.showErrors(err);
                });
            },
    
            confirmReject: function () {
                return false;
            }
        }
    });
    
    __exports__["default"] = UploadController;
  });
define("ghost/controllers/post-settings-menu", 
  ["ghost/utils/date-formatting","ghost/mixins/settings-menu-controller","ghost/models/slug-generator","ghost/utils/bound-one-way","ghost/utils/isNumber","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    /* global moment */
    var parseDateString = __dependency1__.parseDateString;
    var formatDate = __dependency1__.formatDate;

    var SettingsMenuMixin = __dependency2__["default"];

    var SlugGenerator = __dependency3__["default"];

    var boundOneWay = __dependency4__["default"];

    var isNumber = __dependency5__["default"];

    
    var PostSettingsMenuController = Ember.Controller.extend(SettingsMenuMixin, {
        debounceId: null,
        lastPromise: null,
        selectedAuthor: null,
        uploaderReference: null,
    
        initializeSelectedAuthor: function () {
            var self = this;
    
            return this.get('model.author').then(function (author) {
                self.set('selectedAuthor', author);
                return author;
            });
        }.observes('model'),
    
        changeAuthor: function () {
            var author = this.get('model.author'),
                selectedAuthor = this.get('selectedAuthor'),
                model = this.get('model'),
                self = this;
    
            // return if nothing changed
            if (selectedAuthor.get('id') === author.get('id')) {
                return;
            }
    
            model.set('author', selectedAuthor);
    
            // if this is a new post (never been saved before), don't try to save it
            if (this.get('model.isNew')) {
                return;
            }
    
            model.save().catch(function (errors) {
                self.showErrors(errors);
                self.set('selectedAuthor', author);
                model.rollback();
            });
        }.observes('selectedAuthor'),
    
        authors: Ember.computed(function () {
            // Loaded asynchronously, so must use promise proxies.
            var deferred = {};
    
            deferred.promise = this.store.find('user', {limit: 'all'}).then(function (users) {
                return users.rejectBy('id', 'me').sortBy('name');
            }).then(function (users) {
                return users.filter(function (user) {
                    return user.get('active');
                });
            });
    
            return Ember.ArrayProxy
                .extend(Ember.PromiseProxyMixin)
                .create(deferred);
        }),
    
        /*jshint unused:false */
        publishedAtValue: Ember.computed('model.published_at', function (key, value) {
            var pubDate = this.get('model.published_at');
    
            // We're using a fake setter to reset
            // the cache for this property
            if (arguments.length > 1) {
                return formatDate(moment());
            }
    
            if (pubDate) {
                return formatDate(pubDate);
            }
    
            return formatDate(moment());
        }),
        /*jshint unused:true */
    
        slugValue: boundOneWay('model.slug'),
    
        // Lazy load the slug generator
        slugGenerator: Ember.computed(function () {
            return SlugGenerator.create({
                ghostPaths: this.get('ghostPaths'),
                slugType: 'post'
            });
        }),
    
        // Requests slug from title
        generateAndSetSlug: function (destination) {
            var self = this,
                title = this.get('model.titleScratch'),
                afterSave = this.get('lastPromise'),
                promise;
    
            // Only set an "untitled" slug once per post
            if (title === '(Untitled)' && this.get('model.slug')) {
                return;
            }
    
            promise = Ember.RSVP.resolve(afterSave).then(function () {
                return self.get('slugGenerator').generateSlug(title).then(function (slug) {
                    self.set(destination, slug);
                }).catch(function () {
                    // Nothing to do (would be nice to log this somewhere though),
                    // but a rejected promise needs to be handled here so that a resolved
                    // promise is returned.
                });
            });
    
            this.set('lastPromise', promise);
        },
    
        metaTitleScratch: boundOneWay('model.meta_title'),
        metaDescriptionScratch: boundOneWay('model.meta_description'),
    
        seoTitle: Ember.computed('model.titleScratch', 'metaTitleScratch', function () {
            var metaTitle = this.get('metaTitleScratch') || '';
    
            metaTitle = metaTitle.length > 0 ? metaTitle : this.get('model.titleScratch');
    
            if (metaTitle.length > 70) {
                metaTitle = metaTitle.substring(0, 70).trim();
                metaTitle = Ember.Handlebars.Utils.escapeExpression(metaTitle);
                metaTitle = Ember.String.htmlSafe(metaTitle + '&hellip;');
            }
    
            return metaTitle;
        }),
    
        seoDescription: Ember.computed('model.scratch', 'metaDescriptionScratch', function () {
            var metaDescription = this.get('metaDescriptionScratch') || '',
                el,
                html = '',
                placeholder;
    
            if (metaDescription.length > 0) {
                placeholder = metaDescription;
            } else {
                el = $('.rendered-markdown');
    
                // Get rendered markdown
                if (el !== undefined && el.length > 0) {
                    html = el.clone();
                    html.find('.js-drop-zone').remove();
                    html = html[0].innerHTML;
                }
    
                // Strip HTML
                placeholder = $('<div />', {html: html}).text();
                // Replace new lines and trim
                // jscs: disable
                placeholder = placeholder.replace(/\n+/g, ' ').trim();
                // jscs: enable
            }
    
            if (placeholder.length > 156) {
                // Limit to 156 characters
                placeholder = placeholder.substring(0, 156).trim();
                placeholder = Ember.Handlebars.Utils.escapeExpression(placeholder);
                placeholder = Ember.String.htmlSafe(placeholder + '&hellip;');
            }
    
            return placeholder;
        }),
    
        seoURL: Ember.computed('model.slug', function () {
            var blogUrl = this.get('config').blogUrl,
                seoSlug = this.get('model.slug') ? this.get('model.slug') : '',
                seoURL = blogUrl + '/' + seoSlug;
    
            // only append a slash to the URL if the slug exists
            if (seoSlug) {
                seoURL += '/';
            }
    
            if (seoURL.length > 70) {
                seoURL = seoURL.substring(0, 70).trim();
                seoURL = Ember.String.htmlSafe(seoURL + '&hellip;');
            }
    
            return seoURL;
        }),
    
        // observe titleScratch, keeping the post's slug in sync
        // with it until saved for the first time.
        addTitleObserver: function () {
            if (this.get('model.isNew') || this.get('model.title') === '(Untitled)') {
                this.addObserver('model.titleScratch', this, 'titleObserver');
            }
        }.observes('model'),
    
        titleObserver: function () {
            var debounceId,
                title = this.get('model.title');
    
            // generate a slug if a post is new and doesn't have a title yet or
            // if the title is still '(Untitled)' and the slug is unaltered.
            if ((this.get('model.isNew') && !title) || title === '(Untitled)') {
                debounceId = Ember.run.debounce(this, 'generateAndSetSlug', 'model.slug', 700);
            }
    
            this.set('debounceId', debounceId);
        },
    
        showErrors: function (errors) {
            errors = Ember.isArray(errors) ? errors : [errors];
            this.notifications.showErrors(errors);
        },
    
        showSuccess: function (message) {
            this.notifications.showSuccess(message);
        },
    
        actions: {
            togglePage: function () {
                var self = this;
    
                this.toggleProperty('model.page');
                // If this is a new post.  Don't save the model.  Defer the save
                // to the user pressing the save button
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            toggleFeatured: function () {
                var self = this;
    
                this.toggleProperty('model.featured');
    
                // If this is a new post.  Don't save the model.  Defer the save
                // to the user pressing the save button
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save(this.get('saveOptions')).catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            /**
             * triggered by user manually changing slug
             */
            updateSlug: function (newSlug) {
                var slug = this.get('model.slug'),
                    self = this;
    
                newSlug = newSlug || slug;
    
                newSlug = newSlug && newSlug.trim();
    
                // Ignore unchanged slugs or candidate slugs that are empty
                if (!newSlug || slug === newSlug) {
                    // reset the input to its previous state
                    this.set('slugValue', slug);
    
                    return;
                }
    
                this.get('slugGenerator').generateSlug(newSlug).then(function (serverSlug) {
                    // If after getting the sanitized and unique slug back from the API
                    // we end up with a slug that matches the existing slug, abort the change
                    if (serverSlug === slug) {
                        return;
                    }
    
                    // Because the server transforms the candidate slug by stripping
                    // certain characters and appending a number onto the end of slugs
                    // to enforce uniqueness, there are cases where we can get back a
                    // candidate slug that is a duplicate of the original except for
                    // the trailing incrementor (e.g., this-is-a-slug and this-is-a-slug-2)
    
                    // get the last token out of the slug candidate and see if it's a number
                    var slugTokens = serverSlug.split('-'),
                        check = Number(slugTokens.pop());
    
                    // if the candidate slug is the same as the existing slug except
                    // for the incrementor then the existing slug should be used
                    if (isNumber(check) && check > 0) {
                        if (slug === slugTokens.join('-') && serverSlug !== newSlug) {
                            self.set('slugValue', slug);
    
                            return;
                        }
                    }
    
                    self.set('model.slug', serverSlug);
    
                    if (self.hasObserverFor('model.titleScratch')) {
                        self.removeObserver('model.titleScratch', self, 'titleObserver');
                    }
    
                    // If this is a new post.  Don't save the model.  Defer the save
                    // to the user pressing the save button
                    if (self.get('model.isNew')) {
                        return;
                    }
    
                    return self.get('model').save();
                }).catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            /**
             * Parse user's set published date.
             * Action sent by post settings menu view.
             * (#1351)
             */
            setPublishedAt: function (userInput) {
                var errMessage = '',
                    newPublishedAt = parseDateString(userInput),
                    publishedAt = this.get('model.published_at'),
                    self = this;
    
                if (!userInput) {
                    // Clear out the published_at field for a draft
                    if (this.get('model.isDraft')) {
                        this.set('model.published_at', null);
                    }
    
                    return;
                }
    
                // Validate new Published date
                if (!newPublishedAt.isValid()) {
                    errMessage = 'Published Date must be a valid date with format: ' +
                        'DD MMM YY @ HH:mm (e.g. 6 Dec 14 @ 15:00)';
                }
                if (newPublishedAt.diff(new Date(), 'h') > 0) {
                    errMessage = 'Published Date cannot currently be in the future.';
                }
    
                // If errors, notify and exit.
                if (errMessage) {
                    this.showErrors(errMessage);
    
                    return;
                }
    
                // Do nothing if the user didn't actually change the date
                if (publishedAt && publishedAt.isSame(newPublishedAt)) {
                    return;
                }
    
                // Validation complete
                this.set('model.published_at', newPublishedAt);
    
                // If this is a new post.  Don't save the model.  Defer the save
                // to the user pressing the save button
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            setMetaTitle: function (metaTitle) {
                var self = this,
                    currentTitle = this.get('model.meta_title') || '';
    
                // Only update if the title has changed
                if (currentTitle === metaTitle) {
                    return;
                }
    
                this.set('model.meta_title', metaTitle);
    
                // If this is a new post.  Don't save the model.  Defer the save
                // to the user pressing the save button
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                });
            },
    
            setMetaDescription: function (metaDescription) {
                var self = this,
                    currentDescription = this.get('model.meta_description') || '';
    
                // Only update if the description has changed
                if (currentDescription === metaDescription) {
                    return;
                }
    
                this.set('model.meta_description', metaDescription);
    
                // If this is a new post.  Don't save the model.  Defer the save
                // to the user pressing the save button
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                });
            },
    
            setCoverImage: function (image) {
                var self = this;
    
                this.set('model.image', image);
    
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            clearCoverImage: function () {
                var self = this;
    
                this.set('model.image', '');
    
                if (this.get('model.isNew')) {
                    return;
                }
    
                this.get('model').save().catch(function (errors) {
                    self.showErrors(errors);
                    self.get('model').rollback();
                });
            },
    
            resetUploader: function () {
                var uploader = this.get('uploaderReference');
    
                if (uploader && uploader[0]) {
                    uploader[0].uploaderUi.reset();
                }
            },
    
            resetPubDate: function () {
                this.set('publishedAtValue', '');
            }
        }
    });
    
    __exports__["default"] = PostSettingsMenuController;
  });
define("ghost/controllers/post-tags-input", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PostTagsInputController = Ember.Controller.extend({
        tagEnteredOrder: Ember.A(),
    
        tags: Ember.computed('parentController.model.tags', function () {
            var proxyTags = Ember.ArrayProxy.create({
                content: this.get('parentController.model.tags')
            }),
            temp = proxyTags.get('arrangedContent').slice();
    
            proxyTags.get('arrangedContent').clear();
    
            this.get('tagEnteredOrder').forEach(function (tagName) {
                var tag = temp.find(function (tag) {
                    return tag.get('name') === tagName;
                });
    
                if (tag) {
                    proxyTags.get('arrangedContent').addObject(tag);
                    temp.removeObject(tag);
                }
            });
    
            proxyTags.get('arrangedContent').unshiftObjects(temp);
    
            return proxyTags;
        }),
    
        suggestions: null,
        newTagText: null,
    
        actions: {
            // triggered when the view is inserted so that later store.all('tag')
            // queries hit a full store cache and we don't see empty or out-of-date
            // suggestion lists
            loadAllTags: function () {
                this.store.find('tag', {limit: 'all'});
            },
    
            addNewTag: function () {
                var newTagText = this.get('newTagText'),
                    searchTerm,
                    existingTags,
                    newTag;
    
                if (Ember.isEmpty(newTagText) || this.hasTag(newTagText)) {
                    this.send('reset');
                    return;
                }
    
                newTagText = newTagText.trim();
                searchTerm = newTagText.toLowerCase();
    
                // add existing tag if we have a match
                existingTags = this.store.all('tag').filter(function (tag) {
                    if (tag.get('isNew')) {
                        return false;
                    }
    
                    return tag.get('name').toLowerCase() === searchTerm;
                });
    
                if (existingTags.get('length')) {
                    this.send('addTag', existingTags.get('firstObject'));
                } else {
                    // otherwise create a new one
                    newTag = this.store.createRecord('tag');
                    newTag.set('name', newTagText);
    
                    this.send('addTag', newTag);
                }
    
                this.send('reset');
            },
    
            addTag: function (tag) {
                if (!Ember.isEmpty(tag)) {
                    this.get('tags').addObject(tag);
                    this.get('tagEnteredOrder').addObject(tag.get('name'));
                }
    
                this.send('reset');
            },
    
            deleteTag: function (tag) {
                if (tag) {
                    this.get('tags').removeObject(tag);
                    this.get('tagEnteredOrder').removeObject(tag.get('name'));
                }
            },
    
            deleteLastTag: function () {
                this.send('deleteTag', this.get('tags.lastObject'));
            },
    
            selectSuggestion: function (suggestion) {
                if (!Ember.isEmpty(suggestion)) {
                    this.get('suggestions').setEach('selected', false);
                    suggestion.set('selected', true);
                }
            },
    
            selectNextSuggestion: function () {
                var suggestions = this.get('suggestions'),
                    selectedSuggestion = this.get('selectedSuggestion'),
                    currentIndex,
                    newSelection;
    
                if (!Ember.isEmpty(suggestions)) {
                    currentIndex = suggestions.indexOf(selectedSuggestion);
                    if (currentIndex + 1 < suggestions.get('length')) {
                        newSelection = suggestions[currentIndex + 1];
                        this.send('selectSuggestion', newSelection);
                    } else {
                        suggestions.setEach('selected', false);
                    }
                }
            },
    
            selectPreviousSuggestion: function () {
                var suggestions = this.get('suggestions'),
                    selectedSuggestion = this.get('selectedSuggestion'),
                    currentIndex,
                    lastIndex,
                    newSelection;
    
                if (!Ember.isEmpty(suggestions)) {
                    currentIndex = suggestions.indexOf(selectedSuggestion);
                    if (currentIndex === -1) {
                        lastIndex = suggestions.get('length') - 1;
                        this.send('selectSuggestion', suggestions[lastIndex]);
                    } else if (currentIndex - 1 >= 0) {
                        newSelection = suggestions[currentIndex - 1];
                        this.send('selectSuggestion', newSelection);
                    } else {
                        suggestions.setEach('selected', false);
                    }
                }
            },
    
            addSelectedSuggestion: function () {
                var suggestion = this.get('selectedSuggestion');
    
                if (Ember.isEmpty(suggestion)) {
                    return;
                }
    
                this.send('addTag', suggestion.get('tag'));
            },
    
            reset: function () {
                this.set('suggestions', null);
                this.set('newTagText', null);
            }
        },
    
        selectedSuggestion: Ember.computed('suggestions.@each.selected', function () {
            var suggestions = this.get('suggestions');
    
            if (suggestions && suggestions.get('length')) {
                return suggestions.filterBy('selected').get('firstObject');
            } else {
                return null;
            }
        }),
    
        updateSuggestionsList: function () {
            var searchTerm = this.get('newTagText'),
                matchingTags,
                // Limit the suggestions number
                maxSuggestions = 5,
                suggestions = Ember.A();
    
            if (!searchTerm || Ember.isEmpty(searchTerm.trim())) {
                this.set('suggestions', null);
                return;
            }
    
            searchTerm = searchTerm.trim();
    
            matchingTags = this.findMatchingTags(searchTerm);
            matchingTags = matchingTags.slice(0, maxSuggestions);
            matchingTags.forEach(function (matchingTag) {
                var suggestion = this.makeSuggestionObject(matchingTag, searchTerm);
                suggestions.pushObject(suggestion);
            }, this);
    
            this.set('suggestions', suggestions);
        }.observes('newTagText'),
    
        findMatchingTags: function (searchTerm) {
            var matchingTags,
                self = this,
                allTags = this.store.all('tag').filterBy('isNew', false),
                deDupe = {};
    
            if (allTags.get('length') === 0) {
                return [];
            }
    
            searchTerm = searchTerm.toLowerCase();
    
            matchingTags = allTags.filter(function (tag) {
                var tagNameMatches,
                    hasAlreadyBeenAdded,
                    tagName = tag.get('name');
    
                tagNameMatches = tagName.toLowerCase().indexOf(searchTerm) !== -1;
                hasAlreadyBeenAdded = self.hasTag(tagName);
    
                if (tagNameMatches && !hasAlreadyBeenAdded) {
                    if (typeof deDupe[tagName] === 'undefined') {
                        deDupe[tagName] = 1;
                    } else {
                        deDupe[tagName] += 1;
                    }
                }
    
                return deDupe[tagName] === 1;
            });
    
            return matchingTags;
        },
    
        hasTag: function (tagName) {
            return this.get('tags').mapBy('name').contains(tagName);
        },
    
        makeSuggestionObject: function (matchingTag, _searchTerm) {
            var searchTerm = Ember.Handlebars.Utils.escapeExpression(_searchTerm),
                regexEscapedSearchTerm = searchTerm.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'),
                tagName = Ember.Handlebars.Utils.escapeExpression(matchingTag.get('name')),
                regex = new RegExp('(' + regexEscapedSearchTerm + ')', 'gi'),
                highlightedName,
                suggestion = Ember.Object.create();
    
            highlightedName = tagName.replace(regex, '<mark>$1</mark>');
            highlightedName = Ember.String.htmlSafe(highlightedName);
    
            suggestion.set('tag', matchingTag);
            suggestion.set('highlightedName', highlightedName);
    
            return suggestion;
        }
    });
    
    __exports__["default"] = PostTagsInputController;
  });
define("ghost/controllers/posts", 
  ["ghost/mixins/pagination-controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var PaginationControllerMixin = __dependency1__["default"];

    
    function publishedAtCompare(item1, item2) {
        var published1 = item1.get('published_at'),
            published2 = item2.get('published_at');
    
        if (!published1 && !published2) {
            return 0;
        }
    
        if (!published1 && published2) {
            return -1;
        }
    
        if (!published2 && published1) {
            return 1;
        }
    
        return Ember.compare(published1.valueOf(), published2.valueOf());
    }
    
    var PostsController = Ember.ArrayController.extend(PaginationControllerMixin, {
        // See PostsRoute's shortcuts
        postListFocused: Ember.computed.equal('keyboardFocus', 'postList'),
        postContentFocused: Ember.computed.equal('keyboardFocus', 'postContent'),
        // this will cause the list to re-sort when any of these properties change on any of the models
        sortProperties: ['status', 'published_at', 'updated_at'],
    
        // override Ember.SortableMixin
        //
        // this function will keep the posts list sorted when loading individual/bulk
        // models from the server, even if records in between haven't been loaded.
        // this can happen when reloading the page on the Editor or PostsPost routes.
        //
        // a custom sort function is needed in order to sort the posts list the same way the server would:
        //     status: ASC
        //     published_at: DESC
        //     updated_at: DESC
        //     id: DESC
        orderBy: function (item1, item2) {
            var updated1 = item1.get('updated_at'),
                updated2 = item2.get('updated_at'),
                idResult,
                statusResult,
                updatedAtResult,
                publishedAtResult;
    
            // when `updated_at` is undefined, the model is still
            // being written to with the results from the server
            if (item1.get('isNew') || !updated1) {
                return -1;
            }
    
            if (item2.get('isNew') || !updated2) {
                return 1;
            }
    
            idResult = Ember.compare(parseInt(item1.get('id')), parseInt(item2.get('id')));
            statusResult = Ember.compare(item1.get('status'), item2.get('status'));
            updatedAtResult = Ember.compare(updated1.valueOf(), updated2.valueOf());
            publishedAtResult = publishedAtCompare(item1, item2);
    
            if (statusResult === 0) {
                if (publishedAtResult === 0) {
                    if (updatedAtResult === 0) {
                        // This should be DESC
                        return idResult * -1;
                    }
                    // This should be DESC
                    return updatedAtResult * -1;
                }
                // This should be DESC
                return publishedAtResult * -1;
            }
    
            return statusResult;
        },
    
        init: function () {
            // let the PaginationControllerMixin know what type of model we will be paginating
            // this is necesariy because we do not have access to the model inside the Controller::init method
            this._super({modelType: 'post'});
        }
    });
    
    __exports__["default"] = PostsController;
  });
define("ghost/controllers/posts/post", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PostController = Ember.Controller.extend({
        isPublished: Ember.computed.equal('model.status', 'published'),
        classNameBindings: ['model.featured'],
    
        authorName: Ember.computed('model.author.name', 'model.author.email', function () {
            return this.get('model.author.name') || this.get('model.author.email');
        }),
    
        authorAvatar: Ember.computed('model.author.image', function () {
            return this.get('model.author.image') || this.get('ghostPaths.url').asset('/shared/img/user-image.png');
        }),
    
        authorAvatarBackground: Ember.computed('authorAvatar', function () {
            return 'background-image: url(' + this.get('authorAvatar') + ')';
        }),
    
        actions: {
            toggleFeatured: function () {
                var options = {disableNProgress: true},
                    self = this;
    
                this.toggleProperty('model.featured');
                this.get('model').save(options).catch(function (errors) {
                    self.notifications.showErrors(errors);
                });
            },
            showPostContent: function () {
                this.transitionToRoute('posts.post', this.get('model'));
            }
        }
    });
    
    __exports__["default"] = PostController;
  });
define("ghost/controllers/reset", 
  ["ghost/utils/ajax","ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ajax = __dependency1__["default"];

    var ValidationEngine = __dependency2__["default"];

    
    var ResetController = Ember.Controller.extend(ValidationEngine, {
        newPassword: '',
        ne2Password: '',
        token: '',
        submitting: false,
    
        validationType: 'reset',
    
        email: Ember.computed('token', function () {
            // The token base64 encodes the email (and some other stuff),
            // each section is divided by a '|'. Email comes second.
            return atob(this.get('token')).split('|')[1];
        }),
    
        // Used to clear sensitive information
        clearData: function () {
            this.setProperties({
                newPassword: '',
                ne2Password: '',
                token: ''
            });
        },
    
        actions: {
            submit: function () {
                var credentials = this.getProperties('newPassword', 'ne2Password', 'token'),
                    self = this;
    
                this.toggleProperty('submitting');
                this.validate({format: false}).then(function () {
                    ajax({
                        url: self.get('ghostPaths.url').api('authentication', 'passwordreset'),
                        type: 'PUT',
                        data: {
                            passwordreset: [credentials]
                        }
                    }).then(function (resp) {
                        self.toggleProperty('submitting');
                        self.notifications.showSuccess(resp.passwordreset[0].message, true);
                        self.get('session').authenticate('simple-auth-authenticator:oauth2-password-grant', {
                            identification: self.get('email'),
                            password: credentials.newPassword
                        });
                    }).catch(function (response) {
                        self.notifications.showAPIError(response);
                        self.toggleProperty('submitting');
                    });
                }).catch(function (error) {
                    self.toggleProperty('submitting');
                    self.notifications.showErrors(error);
                });
            }
        }
    });
    
    __exports__["default"] = ResetController;
  });
define("ghost/controllers/settings", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingsController = Ember.Controller.extend({
        needs: ['feature'],
    
        showGeneral: Ember.computed('session.user.name', function () {
            return this.get('session.user.isAuthor') || this.get('session.user.isEditor') ? false : true;
        }),
        showUsers: Ember.computed('session.user.name', function () {
            return this.get('session.user.isAuthor') ? false : true;
        }),
        showTags: Ember.computed('session.user.name', function () {
            return this.get('session.user.isAuthor') ? false : true;
        }),
        showNavigation: Ember.computed('session.user.name', 'config.navigationUI', function () {
            return this.get('session.user.isAuthor') || this.get('session.user.isEditor') || !this.get('config.navigationUI') ? false : true;
        }),
        showCodeInjection: Ember.computed('session.user.name', 'controllers.feature.codeInjectionUI', function () {
            return this.get('session.user.isAuthor') || this.get('session.user.isEditor') || !this.get('controllers.feature.codeInjectionUI') ? false : true;
        }),
        showLabs: Ember.computed('session.user.name', function () {
            return this.get('session.user.isAuthor')  || this.get('session.user.isEditor') ? false : true;
        }),
        showAbout: Ember.computed('session.user.name', function () {
            return this.get('session.user.isAuthor') ? false : true;
        })
    });
    
    __exports__["default"] = SettingsController;
  });
define("ghost/controllers/settings/app", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*global alert */
    
    var appStates,
        SettingsAppController;
    
    appStates = {
        active: 'active',
        working: 'working',
        inactive: 'inactive'
    };
    
    SettingsAppController = Ember.Controller.extend({
        appState: appStates.active,
        buttonText: '',
    
        setAppState: function () {
            this.set('appState', this.get('active') ? appStates.active : appStates.inactive);
        }.on('init'),
    
        buttonTextSetter: function () {
            switch (this.get('appState')) {
                case appStates.active:
                    this.set('buttonText', 'Deactivate');
                    break;
                case appStates.inactive:
                    this.set('buttonText', 'Activate');
                    break;
                case appStates.working:
                    this.set('buttonText', 'Working');
                    break;
            }
        }.observes('appState').on('init'),
    
        activeClass: Ember.computed('appState', function () {
            return this.appState === appStates.active ? true : false;
        }),
    
        inactiveClass: Ember.computed('appState', function () {
            return this.appState === appStates.inactive ? true : false;
        }),
    
        actions: {
            toggleApp: function (app) {
                var self = this;
    
                this.set('appState', appStates.working);
    
                app.set('active', !app.get('active'));
    
                app.save().then(function () {
                    self.setAppState();
                })
                .then(function () {
                    alert('@TODO: Success');
                })
                .catch(function () {
                    alert('@TODO: Failure');
                });
            }
        }
    });
    
    __exports__["default"] = SettingsAppController;
  });
define("ghost/controllers/settings/code-injection", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingsCodeInjectionController = Ember.Controller.extend({
        actions: {
            save: function () {
                var self = this;
    
                return this.get('model').save().then(function (model) {
                    self.notifications.closePassive();
                    self.notifications.showSuccess('Settings successfully saved.');
    
                    return model;
                }).catch(function (errors) {
                    self.notifications.closePassive();
                    self.notifications.showErrors(errors);
                });
            }
        }
    });
    
    __exports__["default"] = SettingsCodeInjectionController;
  });
define("ghost/controllers/settings/general", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingsGeneralController = Ember.Controller.extend({
        selectedTheme: null,
    
        logoImageSource: Ember.computed('model.logo', function () {
            return this.get('model.logo') || '';
        }),
    
        coverImageSource: Ember.computed('model.cover', function () {
            return this.get('model.cover') || '';
        }),
    
        isDatedPermalinks: Ember.computed('model.permalinks', function (key, value) {
            // setter
            if (arguments.length > 1) {
                this.set('model.permalinks', value ? '/:year/:month/:day/:slug/' : '/:slug/');
            }
    
            // getter
            var slugForm = this.get('model.permalinks');
    
            return slugForm !== '/:slug/';
        }),
    
        themes: Ember.computed(function () {
            return this.get('model.availableThemes').reduce(function (themes, t) {
                var theme = {};
    
                theme.name = t.name;
                theme.label = t.package ? t.package.name + ' - ' + t.package.version : t.name;
                theme.package = t.package;
                theme.active = !!t.active;
    
                themes.push(theme);
    
                return themes;
            }, []);
        }).readOnly(),
    
        actions: {
            save: function () {
                var self = this;
    
                return this.get('model').save().then(function (model) {
                    self.notifications.showSuccess('Settings successfully saved.');
    
                    return model;
                }).catch(function (errors) {
                    self.notifications.showErrors(errors);
                });
            },
    
            checkPostsPerPage: function () {
                var postsPerPage = this.get('model.postsPerPage');
    
                if (postsPerPage < 1 || postsPerPage > 1000 || isNaN(postsPerPage)) {
                    this.set('model.postsPerPage', 5);
                }
            }
        }
    });
    
    __exports__["default"] = SettingsGeneralController;
  });
define("ghost/controllers/settings/labs", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var LabsController = Ember.Controller.extend(Ember.Evented, {
        needs: ['feature'],
    
        uploadButtonText: 'Import',
        importErrors: '',
        labsJSON: Ember.computed('model.labs', function () {
            return JSON.parse(this.get('model.labs') || {});
        }),
    
        saveLabs: function (optionName, optionValue) {
            var self = this,
                labsJSON =  this.get('labsJSON');
    
            // Set new value in the JSON object
            labsJSON[optionName] = optionValue;
    
            this.set('model.labs', JSON.stringify(labsJSON));
    
            this.get('model').save().catch(function (errors) {
                self.showErrors(errors);
                self.get('model').rollback();
            });
        },
    
        codeUIFlag: Ember.computed.alias('config.codeInjectionUI'),
    
        useCodeInjectionUI: Ember.computed('controllers.feature.codeInjectionUI', function (key, value) {
            // setter
            if (arguments.length > 1) {
                this.saveLabs('codeInjectionUI', value);
            }
    
            // getter
            return this.get('controllers.feature.codeInjectionUI') || false;
        }),
    
        actions: {
            onUpload: function (file) {
                var self = this,
                    formData = new FormData();
    
                this.set('uploadButtonText', 'Importing');
                this.set('importErrors', '');
                this.notifications.closePassive();
    
                formData.append('importfile', file);
    
                ic.ajax.request(this.get('ghostPaths.url').api('db'), {
                    type: 'POST',
                    data: formData,
                    dataType: 'json',
                    cache: false,
                    contentType: false,
                    processData: false
                }).then(function () {
                    // Clear the store, so that all the new data gets fetched correctly.
                    self.store.unloadAll('post');
                    self.store.unloadAll('tag');
                    self.store.unloadAll('user');
                    self.store.unloadAll('role');
                    self.store.unloadAll('setting');
                    self.store.unloadAll('notification');
                    self.notifications.showSuccess('Import successful.');
                }).catch(function (response) {
                    if (response && response.jqXHR && response.jqXHR.responseJSON && response.jqXHR.responseJSON.errors) {
                        self.set('importErrors', response.jqXHR.responseJSON.errors);
                    }
    
                    self.notifications.showError('Import Failed');
                }).finally(function () {
                    self.set('uploadButtonText', 'Import');
                    self.trigger('reset');
                });
            },
    
            exportData: function () {
                var iframe = $('#iframeDownload'),
                    downloadURL = this.get('ghostPaths.url').api('db') +
                        '?access_token=' + this.get('session.access_token');
    
                if (iframe.length === 0) {
                    iframe = $('<iframe>', {id: 'iframeDownload'}).hide().appendTo('body');
                }
    
                iframe.attr('src', downloadURL);
            },
    
            sendTestEmail: function () {
                var self = this;
    
                ic.ajax.request(this.get('ghostPaths.url').api('mail', 'test'), {
                    type: 'POST'
                }).then(function () {
                    self.notifications.showSuccess('Check your email for the test message.');
                }).catch(function (error) {
                    if (typeof error.jqXHR !== 'undefined') {
                        self.notifications.showAPIError(error);
                    } else {
                        self.notifications.showErrors(error);
                    }
                });
            }
        }
    });
    
    __exports__["default"] = LabsController;
  });
define("ghost/controllers/settings/navigation", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NavigationController,
        NavItem;
    
    NavItem = Ember.Object.extend({
        label: '',
        url: '',
        order: '',
    
        isComplete: Ember.computed('label', 'url', function () {
            return !(Ember.isBlank(this.get('label')) || Ember.isBlank(this.get('url')));
        })
    });
    
    NavigationController = Ember.Controller.extend({
        blogUrl: Ember.computed('config.blogUrl', function () {
            var url = this.get('config.blogUrl');
    
            return url.slice(-1) !== '/' ? url + '/' : url;
        }),
    
        navigationItems: Ember.computed('model.navigation', function () {
            var navItems,
                lastItem;
    
            try {
                navItems = JSON.parse(this.get('model.navigation') || [{}]);
            } catch (e) {
                navItems = [{}];
            }
    
            navItems = navItems.map(function (item) {
                return NavItem.create(item);
            });
    
            navItems.sortBy('order');
    
            lastItem = navItems.get('lastObject');
            if (!lastItem || lastItem.get('isComplete')) {
                navItems.addObject(NavItem.create());
            }
    
            return navItems;
        }),
    
        navigationItemsObserver: Ember.observer('navigationItems.[]', function () {
            var navItems = this.get('navigationItems');
    
            navItems.forEach(function (item, index, items) {
                if (index === (items.length - 1)) {
                    item.set('last', true);
                } else {
                    item.set('last', false);
                }
            });
        }),
    
        updateOrder: function (indexes) {
            var navItems = this.get('navigationItems'),
                order = 0;
    
            indexes.forEach(function (index) {
                navItems[index].set('order', order);
                order = order + 1; // Increment order order by one
            });
        },
    
        actions: {
            addItem: function () {
                var navItems = this.get('navigationItems'),
                    lastItem = navItems.get('lastObject');
    
                if (lastItem && lastItem.get('isComplete')) {
                    lastItem.set('order', (navItems.length - 1)); // -1 because order is 0-index, length is 1-index
                    navItems.addObject(NavItem.create()); // Adds new blank navItem
                }
            },
    
            deleteItem: function (item) {
                if (!item) {
                    return;
                }
    
                this.get('navigationItems').removeObject(item);
    
                var navItems = this.get('navigationItems'),
                    order = 0;
    
                navItems.forEach(function (item) {
                    item.set('order', order);
                    order = order + 1; // Increment order order by one
                });
            },
    
            updateUrl: function (url, navItem) {
                if (!navItem) {
                    return;
                }
    
                if (Ember.isBlank(url)) {
                    navItem.set('url', this.get('blogUrl'));
    
                    return;
                }
    
                navItem.set('url', url);
            },
    
            save: function () {
                var self = this,
                    navSetting,
                    blogUrl = this.get('config').blogUrl,
                    blogUrlRegex = new RegExp('^' + blogUrl + '(.*)', 'i'),
                    match;
    
                navSetting = this.get('navigationItems').map(function (item) {
                    var label,
                        url,
                        order;
    
                    if (!item || !item.get('isComplete')) {
                        return;
                    }
    
                    label = item.get('label').trim();
                    url = item.get('url').trim();
                    order = item.get('order');
    
                    match = url.match(blogUrlRegex);
    
                    if (match) {
                        if (match[1] === '') {
                            url = '/';
                        } else {
                            url = match[1];
                        }
                    } else if (!validator.isURL(url) && url !== '' && url[0] !== '/') {
                        url = '/' + url;
                    }
    
                    // if navItem label is empty and URL is still the default, don't save
                    if (!label && url === '/') {
                        return;
                    }
    
                    return {label: label, url: url, order: order};
                }).compact();
    
                // Sort JSON so nav items are stored in the correct order order
                navSetting.sort(function (a, b) {
                    return a.order - b.order;
                });
    
                this.set('model.navigation', JSON.stringify(navSetting));
    
                // trigger change event because even if the final JSON is unchanged
                // we need to have navigationItems recomputed.
                this.get('model').notifyPropertyChange('navigation');
    
                this.notifications.closePassive();
    
                this.get('model').save().then(function () {
                    self.notifications.showSuccess('Navigation items saved.');
                }).catch(function (err) {
                    self.notifications.showErrors(err);
                });
            }
        }
    });
    
    __exports__["default"] = NavigationController;
  });
define("ghost/controllers/settings/tags", 
  ["ghost/mixins/pagination-controller","ghost/mixins/settings-menu-controller","ghost/utils/bound-one-way","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var PaginationMixin = __dependency1__["default"];

    var SettingsMenuMixin = __dependency2__["default"];

    var boundOneWay = __dependency3__["default"];

    
    var TagsController = Ember.ArrayController.extend(PaginationMixin, SettingsMenuMixin, {
        tags: Ember.computed.alias('model'),
    
        activeTag: null,
        activeTagNameScratch: boundOneWay('activeTag.name'),
        activeTagSlugScratch: boundOneWay('activeTag.slug'),
        activeTagDescriptionScratch: boundOneWay('activeTag.description'),
        activeTagMetaTitleScratch: boundOneWay('activeTag.meta_title'),
        activeTagMetaDescriptionScratch: boundOneWay('activeTag.meta_description'),
    
        init: function (options) {
            options = options || {};
            options.modelType = 'tag';
            this._super(options);
        },
    
        showErrors: function (errors) {
            errors = Ember.isArray(errors) ? errors : [errors];
            this.notifications.showErrors(errors);
        },
    
        saveActiveTagProperty: function (propKey, newValue) {
            var activeTag = this.get('activeTag'),
                currentValue = activeTag.get(propKey),
                self = this;
    
            newValue = newValue.trim();
    
            // Quit if there was no change
            if (newValue === currentValue) {
                return;
            }
    
            activeTag.set(propKey, newValue);
    
            this.notifications.closePassive();
    
            activeTag.save().catch(function (errors) {
                self.showErrors(errors);
            });
        },
    
        seoTitle: Ember.computed('scratch', 'activeTagNameScratch', 'activeTagMetaTitleScratch', function () {
            var metaTitle = this.get('activeTagMetaTitleScratch') || '';
    
            metaTitle = metaTitle.length > 0 ? metaTitle : this.get('activeTagNameScratch');
    
            if (metaTitle && metaTitle.length > 70) {
                metaTitle = metaTitle.substring(0, 70).trim();
                metaTitle = Ember.Handlebars.Utils.escapeExpression(metaTitle);
                metaTitle = Ember.String.htmlSafe(metaTitle + '&hellip;');
            }
    
            return metaTitle;
        }),
    
        seoURL: Ember.computed('activeTagSlugScratch', function () {
            var blogUrl = this.get('config').blogUrl,
                seoSlug = this.get('activeTagSlugScratch') ? this.get('activeTagSlugScratch') : '',
                seoURL = blogUrl + '/tag/' + seoSlug;
    
            // only append a slash to the URL if the slug exists
            if (seoSlug) {
                seoURL += '/';
            }
    
            if (seoURL.length > 70) {
                seoURL = seoURL.substring(0, 70).trim();
                seoURL = Ember.String.htmlSafe(seoURL + '&hellip;');
            }
    
            return seoURL;
        }),
    
        seoDescription: Ember.computed('scratch', 'activeTagDescriptionScratch', 'activeTagMetaDescriptionScratch', function () {
            var metaDescription = this.get('activeTagMetaDescriptionScratch') || '';
    
            metaDescription = metaDescription.length > 0 ? metaDescription : this.get('activeTagDescriptionScratch');
    
            if (metaDescription && metaDescription.length > 156) {
                metaDescription = metaDescription.substring(0, 156).trim();
                metaDescription = Ember.Handlebars.Utils.escapeExpression(metaDescription);
                metaDescription = Ember.String.htmlSafe(metaDescription + '&hellip;');
            }
    
            return metaDescription;
        }),
    
        actions: {
            newTag: function () {
                this.set('activeTag', this.store.createRecord('tag', {post_count: 0}));
                this.send('openSettingsMenu');
            },
    
            editTag: function (tag) {
                this.set('activeTag', tag);
                this.send('openSettingsMenu');
            },
    
            saveActiveTagName: function (name) {
                this.saveActiveTagProperty('name', name);
            },
    
            saveActiveTagSlug: function (slug) {
                this.saveActiveTagProperty('slug', slug);
            },
    
            saveActiveTagDescription: function (description) {
                this.saveActiveTagProperty('description', description);
            },
    
            saveActiveTagMetaTitle: function (metaTitle) {
                this.saveActiveTagProperty('meta_title', metaTitle);
            },
    
            saveActiveTagMetaDescription: function (metaDescription) {
                this.saveActiveTagProperty('meta_description', metaDescription);
            },
    
            setCoverImage: function (image) {
                this.saveActiveTagProperty('image', image);
            },
    
            clearCoverImage: function () {
                this.saveActiveTagProperty('image', '');
            }
        }
    });
    
    __exports__["default"] = TagsController;
  });
define("ghost/controllers/settings/users/index", 
  ["ghost/mixins/pagination-controller","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var PaginationControllerMixin = __dependency1__["default"];

    
    var UsersIndexController = Ember.ArrayController.extend(PaginationControllerMixin, {
        init: function () {
            // let the PaginationControllerMixin know what type of model we will be paginating
            // this is necessary because we do not have access to the model inside the Controller::init method
            this._super({modelType: 'user'});
        },
    
        users: Ember.computed.alias('model'),
    
        activeUsers: Ember.computed.filter('users', function (user) {
            return /^active|warn-[1-4]|locked$/.test(user.get('status'));
        }),
    
        invitedUsers: Ember.computed.filter('users', function (user) {
            var status = user.get('status');
    
            return status === 'invited' || status === 'invited-pending';
        })
    });
    
    __exports__["default"] = UsersIndexController;
  });
define("ghost/controllers/settings/users/user", 
  ["ghost/models/slug-generator","ghost/utils/isNumber","ghost/utils/bound-one-way","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var SlugGenerator = __dependency1__["default"];

    var isNumber = __dependency2__["default"];

    var boundOneWay = __dependency3__["default"];

    
    var SettingsUserController = Ember.Controller.extend({
    
        user: Ember.computed.alias('model'),
    
        email: Ember.computed.readOnly('model.email'),
    
        slugValue: boundOneWay('model.slug'),
    
        lastPromise: null,
    
        coverDefault: Ember.computed('ghostPaths', function () {
            return this.get('ghostPaths.url').asset('/shared/img/user-cover.png');
        }),
    
        userDefault: Ember.computed('ghostPaths', function () {
            return this.get('ghostPaths.url').asset('/shared/img/user-image.png');
        }),
    
        cover: Ember.computed('user.cover', 'coverDefault', function () {
            var cover = this.get('user.cover');
    
            if (Ember.isBlank(cover)) {
                cover = this.get('coverDefault');
            }
    
            return 'background-image: url(' + cover + ')';
        }),
    
        coverTitle: Ember.computed('user.name', function () {
            return this.get('user.name') + '\'s Cover Image';
        }),
    
        image: Ember.computed('imageUrl', function () {
            return 'background-image: url(' + this.get('imageUrl') + ')';
        }),
    
        imageUrl: Ember.computed('user.image', function () {
            return this.get('user.image') || this.get('userDefault');
        }),
    
        last_login: Ember.computed('user.last_login', function () {
            var lastLogin = this.get('user.last_login');
    
            return lastLogin ? lastLogin.fromNow() : '(Never)';
        }),
    
        created_at: Ember.computed('user.created_at', function () {
            var createdAt = this.get('user.created_at');
    
            return createdAt ? createdAt.fromNow() : '';
        }),
    
        // Lazy load the slug generator for slugPlaceholder
        slugGenerator: Ember.computed(function () {
            return SlugGenerator.create({
                ghostPaths: this.get('ghostPaths'),
                slugType: 'user'
            });
        }),
    
        actions: {
            changeRole: function (newRole) {
                this.set('model.role', newRole);
            },
    
            revoke: function () {
                var self = this,
                    model = this.get('model'),
                    email = this.get('email');
    
                // reload the model to get the most up-to-date user information
                model.reload().then(function () {
                    if (model.get('invited')) {
                        model.destroyRecord().then(function () {
                            var notificationText = 'Invitation revoked. (' + email + ')';
                            self.notifications.showSuccess(notificationText, false);
                        }).catch(function (error) {
                            self.notifications.showAPIError(error);
                        });
                    } else {
                        // if the user is no longer marked as "invited", then show a warning and reload the route
                        self.get('target').send('reload');
                        self.notifications.showError('This user has already accepted the invitation.', {delayed: 500});
                    }
                });
            },
    
            resend: function () {
                var self = this;
    
                this.get('model').resendInvite().then(function (result) {
                    var notificationText = 'Invitation resent! (' + self.get('email') + ')';
                    // If sending the invitation email fails, the API will still return a status of 201
                    // but the user's status in the response object will be 'invited-pending'.
                    if (result.users[0].status === 'invited-pending') {
                        self.notifications.showWarn('Invitation email was not sent.  Please try resending.');
                    } else {
                        self.get('model').set('status', result.users[0].status);
                        self.notifications.showSuccess(notificationText);
                    }
                }).catch(function (error) {
                    self.notifications.showAPIError(error);
                });
            },
    
            save: function () {
                var user = this.get('user'),
                    slugValue = this.get('slugValue'),
                    afterUpdateSlug = this.get('lastPromise'),
                    promise,
                    slugChanged,
                    self = this;
    
                if (user.get('slug') !== slugValue) {
                    slugChanged = true;
                    user.set('slug', slugValue);
                }
    
                promise = Ember.RSVP.resolve(afterUpdateSlug).then(function () {
                    return user.save({format: false});
                }).then(function (model) {
                    var currentPath,
                        newPath;
    
                    self.notifications.showSuccess('Settings successfully saved.');
    
                    // If the user's slug has changed, change the URL and replace
                    // the history so refresh and back button still work
                    if (slugChanged) {
                        currentPath = window.history.state.path;
    
                        newPath = currentPath.split('/');
                        newPath[newPath.length - 2] = model.get('slug');
                        newPath = newPath.join('/');
    
                        window.history.replaceState({path: newPath}, '', newPath);
                    }
    
                    return model;
                }).catch(function (errors) {
                    self.notifications.showErrors(errors);
                });
    
                this.set('lastPromise', promise);
            },
    
            password: function () {
                var user = this.get('user'),
                    self = this;
    
                if (user.get('isPasswordValid')) {
                    user.saveNewPassword().then(function (model) {
                        // Clear properties from view
                        user.setProperties({
                            password: '',
                            newPassword: '',
                            ne2Password: ''
                        });
    
                        self.notifications.showSuccess('Password updated.');
    
                        return model;
                    }).catch(function (errors) {
                        self.notifications.showAPIError(errors);
                    });
                } else {
                    self.notifications.showErrors(user.get('passwordValidationErrors'));
                }
            },
    
            updateSlug: function (newSlug) {
                var self = this,
                    afterSave = this.get('lastPromise'),
                    promise;
    
                promise = Ember.RSVP.resolve(afterSave).then(function () {
                    var slug = self.get('model.slug');
    
                    newSlug = newSlug || slug;
    
                    newSlug = newSlug.trim();
    
                    // Ignore unchanged slugs or candidate slugs that are empty
                    if (!newSlug || slug === newSlug) {
                        self.set('slugValue', slug);
    
                        return;
                    }
    
                    return self.get('slugGenerator').generateSlug(newSlug).then(function (serverSlug) {
                        // If after getting the sanitized and unique slug back from the API
                        // we end up with a slug that matches the existing slug, abort the change
                        if (serverSlug === slug) {
                            return;
                        }
    
                        // Because the server transforms the candidate slug by stripping
                        // certain characters and appending a number onto the end of slugs
                        // to enforce uniqueness, there are cases where we can get back a
                        // candidate slug that is a duplicate of the original except for
                        // the trailing incrementor (e.g., this-is-a-slug and this-is-a-slug-2)
    
                        // get the last token out of the slug candidate and see if it's a number
                        var slugTokens = serverSlug.split('-'),
                            check = Number(slugTokens.pop());
    
                        // if the candidate slug is the same as the existing slug except
                        // for the incrementor then the existing slug should be used
                        if (isNumber(check) && check > 0) {
                            if (slug === slugTokens.join('-') && serverSlug !== newSlug) {
                                self.set('slugValue', slug);
    
                                return;
                            }
                        }
    
                        self.set('slugValue', serverSlug);
                    });
                });
    
                this.set('lastPromise', promise);
            }
        }
    });
    
    __exports__["default"] = SettingsUserController;
  });
define("ghost/controllers/setup", 
  ["ghost/utils/ajax","ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ajax = __dependency1__["default"];

    var ValidationEngine = __dependency2__["default"];

    
    var SetupController = Ember.Controller.extend(ValidationEngine, {
        blogTitle: null,
        name: null,
        email: null,
        password: null,
        submitting: false,
    
        // ValidationEngine settings
        validationType: 'setup',
    
        actions: {
            setup: function () {
                var self = this,
                    data = self.getProperties('blogTitle', 'name', 'email', 'password');
    
                self.notifications.closePassive();
    
                this.toggleProperty('submitting');
                this.validate({format: false}).then(function () {
                    ajax({
                        url: self.get('ghostPaths.url').api('authentication', 'setup'),
                        type: 'POST',
                        data: {
                            setup: [{
                                name: data.name,
                                email: data.email,
                                password: data.password,
                                blogTitle: data.blogTitle
                            }]
                        }
                    }).then(function () {
                        self.get('session').authenticate('simple-auth-authenticator:oauth2-password-grant', {
                            identification: self.get('email'),
                            password: self.get('password')
                        });
                    }).catch(function (resp) {
                        self.toggleProperty('submitting');
                        self.notifications.showAPIError(resp);
                    });
                }).catch(function (errors) {
                    self.toggleProperty('submitting');
                    self.notifications.showErrors(errors);
                });
            }
        }
    });
    
    __exports__["default"] = SetupController;
  });
define("ghost/controllers/signin", 
  ["ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    
    var SigninController = Ember.Controller.extend(SimpleAuth.AuthenticationControllerMixin, ValidationEngine, {
        authenticator: 'simple-auth-authenticator:oauth2-password-grant',
    
        validationType: 'signin',
    
        actions: {
            authenticate: function () {
                var model = this.get('model'),
                    data = model.getProperties('identification', 'password');
    
                this._super(data).catch(function () {
                    // if authentication fails a rejected promise will be returned.
                    // it needs to be caught so it doesn't generate an exception in the console,
                    // but it's actually "handled" by the sessionAuthenticationFailed action handler.
                });
            },
    
            validateAndAuthenticate: function () {
                var self = this;
    
                // Manually trigger events for input fields, ensuring legacy compatibility with
                // browsers and password managers that don't send proper events on autofill
                $('#login').find('input').trigger('change');
    
                this.validate({format: false}).then(function () {
                    self.notifications.closePassive();
                    self.send('authenticate');
                }).catch(function (errors) {
                    self.notifications.showErrors(errors);
                });
            }
        }
    });
    
    __exports__["default"] = SigninController;
  });
define("ghost/controllers/signup", 
  ["ghost/utils/ajax","ghost/mixins/validation-engine","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ajax = __dependency1__["default"];

    var ValidationEngine = __dependency2__["default"];

    
    var SignupController = Ember.Controller.extend(ValidationEngine, {
        submitting: false,
    
        // ValidationEngine settings
        validationType: 'signup',
    
        actions: {
            signup: function () {
                var self = this,
                    model = this.get('model'),
                    data = model.getProperties('name', 'email', 'password', 'token');
    
                self.notifications.closePassive();
    
                this.toggleProperty('submitting');
                this.validate({format: false}).then(function () {
                    ajax({
                        url: self.get('ghostPaths.url').api('authentication', 'invitation'),
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            invitation: [{
                                name: data.name,
                                email: data.email,
                                password: data.password,
                                token: data.token
                            }]
                        }
                    }).then(function () {
                        self.get('session').authenticate('simple-auth-authenticator:oauth2-password-grant', {
                            identification: self.get('model.email'),
                            password: self.get('model.password')
                        });
                    }, function (resp) {
                        self.toggleProperty('submitting');
                        self.notifications.showAPIError(resp);
                    });
                }, function (errors) {
                    self.toggleProperty('submitting');
                    self.notifications.showErrors(errors);
                });
            }
        }
    });
    
    __exports__["default"] = SignupController;
  });
define("ghost/docs/js/nav", 
  [],
  function() {
    "use strict";
    (function(){
    
        // TODO: unbind click events when nav is desktop sized
    
        // Element vars
        var menu_button = document.querySelector(".menu-button"),
            viewport = document.querySelector(".viewport"),
            global_nav = document.querySelector(".global-nav"),
            page_content = document.querySelector(".viewport .page-content");
    
        // mediaQuery listener
        var mq_max_1025 = window.matchMedia("(max-width: 1025px)");
        mq_max_1025.addListener(show_hide_nav);
        show_hide_nav(mq_max_1025);
    
        menu_button.addEventListener("click", function(e) {
            e.preventDefault();
            if (menu_button.getAttribute('data-nav-open')) {
                close_nav();
            } else {
                open_nav();
            }
        });
    
        page_content.addEventListener("click", function(e) {
            e.preventDefault();
            console.log("click viewport");
            if (viewport.classList.contains("global-nav-expanded")) {
                console.log("close nav from viewport");
                close_nav();
            }
        });
    
        var open_nav = function(){
            menu_button.setAttribute("data-nav-open", "true");
            viewport.classList.add("global-nav-expanded");
            global_nav.classList.add("global-nav-expanded");
        };
    
        var close_nav = function(){
            menu_button.removeAttribute('data-nav-open');
            viewport.classList.remove("global-nav-expanded");
            global_nav.classList.remove("global-nav-expanded");
        };
    
        function show_hide_nav(mq) {
            if (mq.matches) {
                // Window is 1025px or less
            } else {
                // Window is 1026px or more
                viewport.classList.remove("global-nav-expanded");
                global_nav.classList.remove("global-nav-expanded");
            }
        }
    
    })();
  });
define("ghost/helpers/gh-blog-url", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var blogUrl = Ember.HTMLBars.makeBoundHelper(function () {
        return Ember.String.htmlSafe(this.get('config.blogUrl'));
    });
    
    __exports__["default"] = blogUrl;
  });
define("ghost/helpers/gh-count-characters", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var countCharacters = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        var el = document.createElement('span'),
            length,
            content;
    
        if (!arr || !arr.length) {
            return;
        }
    
        content = arr[0] || '';
        length = content.length;
    
        el.className = 'word-count';
    
        if (length > 180) {
            el.style.color = '#E25440';
        } else {
            el.style.color = '#9E9D95';
        }
    
        el.innerHTML = 200 - length;
    
        return Ember.String.htmlSafe(el.outerHTML);
    });
    
    __exports__["default"] = countCharacters;
  });
define("ghost/helpers/gh-count-down-characters", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var countDownCharacters = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        var el = document.createElement('span'),
            content,
            maxCharacters,
            length;
    
        if (!arr || arr.length < 2) {
            return;
        }
    
        content = arr[0] || '';
        maxCharacters = arr[1];
        length = content.length;
    
        el.className = 'word-count';
    
        if (length > maxCharacters) {
            el.style.color = '#E25440';
        } else {
            el.style.color = '#9FBB58';
        }
    
        el.innerHTML = length;
    
        return Ember.String.htmlSafe(el.outerHTML);
    });
    
    __exports__["default"] = countDownCharacters;
  });
define("ghost/helpers/gh-count-words", 
  ["ghost/utils/word-count","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var counter = __dependency1__["default"];

    
    var countWords = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        if (!arr || !arr.length) {
            return;
        }
    
        var markdown,
            count;
    
        markdown = arr[0] || '';
    
        if (/^\s*$/.test(markdown)) {
            return '0 words';
        }
    
        count = counter(markdown);
    
        return count + (count === 1 ? ' word' : ' words');
    });
    
    __exports__["default"] = countWords;
  });
define("ghost/helpers/gh-format-html", 
  ["ghost/utils/caja-sanitizers","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global html_sanitize*/
    var cajaSanitizers = __dependency1__["default"];

    
    var formatHTML = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        if (!arr || !arr.length) {
            return;
        }
    
        var escapedhtml = arr[0] || '';
    
        // replace script and iFrame
        escapedhtml = escapedhtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            '<pre class="js-embed-placeholder">Embedded JavaScript</pre>');
        escapedhtml = escapedhtml.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            '<pre class="iframe-embed-placeholder">Embedded iFrame</pre>');
    
        // sanitize HTML
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        escapedhtml = html_sanitize(escapedhtml, cajaSanitizers.url, cajaSanitizers.id);
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    
        return Ember.String.htmlSafe(escapedhtml);
    });
    
    __exports__["default"] = formatHTML;
  });
define("ghost/helpers/gh-format-markdown", 
  ["ghost/utils/caja-sanitizers","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global Showdown, html_sanitize*/
    var cajaSanitizers = __dependency1__["default"];

    
    var showdown,
        formatMarkdown;
    
    showdown = new Showdown.converter({extensions: ['ghostimagepreview', 'ghostgfm', 'footnotes', 'highlight']});
    
    formatMarkdown = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        if (!arr || !arr.length) {
            return;
        }
    
        var escapedhtml = '',
            markdown = arr[0] || '';
    
        // convert markdown to HTML
        escapedhtml = showdown.makeHtml(markdown);
    
        // replace script and iFrame
        escapedhtml = escapedhtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            '<pre class="js-embed-placeholder">Embedded JavaScript</pre>');
        escapedhtml = escapedhtml.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            '<pre class="iframe-embed-placeholder">Embedded iFrame</pre>');
    
        // sanitize html
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        escapedhtml = html_sanitize(escapedhtml, cajaSanitizers.url, cajaSanitizers.id);
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    
        return Ember.String.htmlSafe(escapedhtml);
    });
    
    __exports__["default"] = formatMarkdown;
  });
define("ghost/helpers/gh-format-timeago", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var formatTimeago = Ember.HTMLBars.makeBoundHelper(function (arr /* hashParams */) {
        if (!arr || !arr.length) {
            return;
        }
    
        var timeago = arr[0];
    
        return moment(timeago).fromNow();
        // stefanpenner says cool for small number of timeagos.
        // For large numbers moment sucks => single Ember.Object based clock better
        // https://github.com/manuelmitasch/ghost-admin-ember-demo/commit/fba3ab0a59238290c85d4fa0d7c6ed1be2a8a82e#commitcomment-5396524
    });
    
    __exports__["default"] = formatTimeago;
  });
define("ghost/helpers/gh-path", 
  ["ghost/utils/ghost-paths","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    // Handlebars Helper {{gh-path}}
    // Usage: Assume 'http://www.myghostblog.org/myblog/'
    // {{gh-path}} or {{gh-path ‘blog’}} for Ghost’s root (/myblog/)
    // {{gh-path ‘admin’}} for Ghost’s admin root (/myblog/ghost/)
    // {{gh-path ‘api’}} for Ghost’s api root (/myblog/ghost/api/v0.1/)
    // {{gh-path 'admin' '/assets/hi.png'}} for resolved url (/myblog/ghost/assets/hi.png)
    var ghostPaths = __dependency1__["default"];

    
    function ghostPathsHelper(path, url) {
        var base,
            argsLength = arguments.length,
            paths = ghostPaths();
    
        // function is always invoked with at least one parameter, so if
        // arguments.length is 1 there were 0 arguments passed in explicitly
        if (argsLength === 1) {
            path = 'blog';
        } else if (argsLength === 2 && !/^(blog|admin|api)$/.test(path)) {
            url = path;
            path = 'blog';
        }
    
        switch (path.toString()) {
            case 'blog':
                base = paths.blogRoot;
                break;
            case 'admin':
                base = paths.adminRoot;
                break;
            case 'api':
                base = paths.apiRoot;
                break;
            default:
                base = paths.blogRoot;
                break;
        }
    
        // handle leading and trailing slashes
    
        base = base[base.length - 1] !== '/' ? base + '/' : base;
    
        if (url && url.length > 0) {
            if (url[0] === '/') {
                url = url.substr(1);
            }
    
            base = base + url;
        }
    
        return Ember.String.htmlSafe(base);
    }
    
    __exports__["default"] = ghostPathsHelper;
  });
define("ghost/initializers/authentication", 
  ["ghost/utils/ghost-paths","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ghostPaths = __dependency1__["default"];

    
    var Ghost,
        AuthenticationInitializer;
    
    Ghost = ghostPaths();
    
    AuthenticationInitializer = {
        name: 'authentication',
        before: 'simple-auth',
        after: 'registerTrailingLocationHistory',
    
        initialize: function (container) {
            window.ENV = window.ENV || {};
    
            window.ENV['simple-auth'] = {
                authenticationRoute: 'signin',
                routeAfterAuthentication: 'posts',
                authorizer: 'simple-auth-authorizer:oauth2-bearer',
                localStorageKey: 'ghost' + (Ghost.subdir.indexOf('/') === 0 ? '-' + Ghost.subdir.substr(1) : '') + ':session'
            };
    
            window.ENV['simple-auth-oauth2'] = {
                serverTokenEndpoint: Ghost.apiRoot + '/authentication/token',
                serverTokenRevocationEndpoint: Ghost.apiRoot + '/authentication/revoke',
                refreshAccessTokens: true
            };
    
            SimpleAuth.Session.reopen({
                user: Ember.computed(function () {
                    return container.lookup('store:main').find('user', 'me');
                })
            });
    
            SimpleAuth.Authenticators.OAuth2.reopen({
                makeRequest: function (url, data) {
                    data.client_id = 'ghost-admin';
                    return this._super(url, data);
                }
            });
        }
    };
    
    __exports__["default"] = AuthenticationInitializer;
  });
define("ghost/initializers/dropdown", 
  ["ghost/utils/dropdown-service","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var DropdownService = __dependency1__["default"];

    
    var dropdownInitializer = {
        name: 'dropdown',
    
        initialize: function (container, application) {
            application.register('dropdown:service', DropdownService);
    
            // Inject dropdowns
            application.inject('component:gh-dropdown', 'dropdown', 'dropdown:service');
            application.inject('component:gh-dropdown-button', 'dropdown', 'dropdown:service');
            application.inject('controller:modals.delete-post', 'dropdown', 'dropdown:service');
            application.inject('controller:modals.transfer-owner', 'dropdown', 'dropdown:service');
            application.inject('route:application', 'dropdown', 'dropdown:service');
    
            // Inject popovers
            application.inject('component:gh-popover', 'dropdown', 'dropdown:service');
            application.inject('component:gh-popover-button', 'dropdown', 'dropdown:service');
            application.inject('route:application', 'dropdown', 'dropdown:service');
        }
    };
    
    __exports__["default"] = dropdownInitializer;
  });
define("ghost/initializers/ghost-config", 
  ["ghost/utils/config-parser","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var getConfig = __dependency1__["default"];

    
    var ConfigInitializer = {
        name: 'config',
    
        initialize: function (container, application) {
            var config = getConfig();
            application.register('ghost:config', config, {instantiate: false});
    
            application.inject('route', 'config', 'ghost:config');
            application.inject('controller', 'config', 'ghost:config');
            application.inject('component', 'config', 'ghost:config');
        }
    };
    
    __exports__["default"] = ConfigInitializer;
  });
define("ghost/initializers/ghost-paths", 
  ["ghost/utils/ghost-paths","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ghostPaths = __dependency1__["default"];

    
    var ghostPathsInitializer = {
        name: 'ghost-paths',
        after: 'store',
    
        initialize: function (container, application) {
            application.register('ghost:paths', ghostPaths(), {instantiate: false});
    
            application.inject('route', 'ghostPaths', 'ghost:paths');
            application.inject('model', 'ghostPaths', 'ghost:paths');
            application.inject('controller', 'ghostPaths', 'ghost:paths');
        }
    };
    
    __exports__["default"] = ghostPathsInitializer;
  });
define("ghost/initializers/notifications", 
  ["ghost/utils/notifications","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var Notifications = __dependency1__["default"];

    
    var injectNotificationsInitializer = {
        name: 'injectNotifications',
        before: 'authentication',
    
        initialize: function (container, application) {
            application.register('notifications:main', Notifications);
    
            application.inject('controller', 'notifications', 'notifications:main');
            application.inject('component', 'notifications', 'notifications:main');
            application.inject('router', 'notifications', 'notifications:main');
            application.inject('route', 'notifications', 'notifications:main');
        }
    };
    
    __exports__["default"] = injectNotificationsInitializer;
  });
define("ghost/initializers/store-injector", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var StoreInjector = {
        name: 'store-injector',
        after: 'store',
    
        initialize: function (container, application) {
            application.inject('component:gh-role-selector', 'store', 'store:main');
        }
    };
    
    __exports__["default"] = StoreInjector;
  });
define("ghost/initializers/trailing-history", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*global Ember */
    
    var trailingHistory,
        registerTrailingLocationHistory;
    
    trailingHistory = Ember.HistoryLocation.extend({
        formatURL: function () {
            // jscs: disable
            return this._super.apply(this, arguments).replace(/\/?$/, '/');
            // jscs: enable
        }
    });
    
    registerTrailingLocationHistory = {
        name: 'registerTrailingLocationHistory',
    
        initialize: function (container, application) {
            application.register('location:trailing-history', trailingHistory);
        }
    };
    
    __exports__["default"] = registerTrailingLocationHistory;
  });
define("ghost/mixins/body-event-listener", 
  ["exports"],
  function(__exports__) {
    "use strict";
    
    // Code modified from Addepar/ember-widgets
    // https://github.com/Addepar/ember-widgets/blob/master/src/mixins.coffee#L39
    
    var BodyEventListener = Ember.Mixin.create({
        bodyElementSelector: 'html',
        bodyClick: Ember.K,
    
        init: function () {
            this._super();
    
            return Ember.run.next(this, this._setupDocumentHandlers);
        },
    
        willDestroy: function () {
            this._super();
    
            return this._removeDocumentHandlers();
        },
    
        _setupDocumentHandlers: function () {
            if (this._clickHandler) {
                return;
            }
    
            var self = this;
    
            this._clickHandler = function () {
                return self.bodyClick();
            };
    
            return $(this.get('bodyElementSelector')).on('click', this._clickHandler);
        },
    
        _removeDocumentHandlers: function () {
            $(this.get('bodyElementSelector')).off('click', this._clickHandler);
            this._clickHandler = null;
        },
    
        // http://stackoverflow.com/questions/152975/how-to-detect-a-click-outside-an-element
        click: function (event) {
            return event.stopPropagation();
        }
    });
    
    __exports__["default"] = BodyEventListener;
  });
define("ghost/mixins/current-user-settings", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var CurrentUserSettings = Ember.Mixin.create({
        currentUser: function () {
            return this.store.find('user', 'me');
        },
    
        transitionAuthor: function () {
            var self = this;
    
            return function (user) {
                if (user.get('isAuthor')) {
                    return self.transitionTo('settings.users.user', user);
                }
    
                return user;
            };
        },
    
        transitionEditor: function () {
            var self = this;
    
            return function (user) {
                if (user.get('isEditor')) {
                    return self.transitionTo('settings.users');
                }
    
                return user;
            };
        }
    });
    
    __exports__["default"] = CurrentUserSettings;
  });
define("ghost/mixins/dropdown-mixin", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*
      Dropdowns and their buttons are evented and do not propagate clicks.
    */
    var DropdownMixin = Ember.Mixin.create(Ember.Evented, {
        classNameBindings: ['isOpen:open:closed'],
        isOpen: false,
    
        click: function (event) {
            this._super(event);
    
            return event.stopPropagation();
        }
    });
    
    __exports__["default"] = DropdownMixin;
  });
define("ghost/mixins/editor-base-controller", 
  ["ghost/mixins/marker-manager","ghost/models/post","ghost/utils/bound-one-way","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    /* global console */
    var MarkerManager = __dependency1__["default"];

    var PostModel = __dependency2__["default"];

    var boundOneWay = __dependency3__["default"];

    
    var watchedProps,
        EditorControllerMixin;
    
    // this array will hold properties we need to watch
    // to know if the model has been changed (`controller.isDirty`)
    watchedProps = ['model.scratch', 'model.titleScratch', 'model.isDirty', 'model.tags.[]'];
    
    PostModel.eachAttribute(function (name) {
        watchedProps.push('model.' + name);
    });
    
    EditorControllerMixin = Ember.Mixin.create(MarkerManager, {
        needs: ['post-tags-input', 'post-settings-menu'],
    
        autoSaveId: null,
        timedSaveId: null,
        codemirror: null,
        codemirrorComponent: null,
    
        init: function () {
            var self = this;
    
            this._super();
    
            window.onbeforeunload = function () {
                return self.get('isDirty') ? self.unloadDirtyMessage() : null;
            };
        },
    
        /**
         * By default, a post will not change its publish state.
         * Only with a user-set value (via setSaveType action)
         * can the post's status change.
         */
        willPublish: boundOneWay('model.isPublished'),
    
        // Make sure editor starts with markdown shown
        isPreview: false,
    
        // set by the editor route and `isDirty`. useful when checking
        // whether the number of tags has changed for `isDirty`.
        previousTagNames: null,
    
        tagNames: Ember.computed('model.tags.@each.name', function () {
            return this.get('model.tags').mapBy('name');
        }),
    
        postOrPage: Ember.computed('model.page', function () {
            return this.get('model.page') ? 'Page' : 'Post';
        }),
    
        // compares previousTagNames to tagNames
        tagNamesEqual: function () {
            var tagNames = this.get('tagNames'),
                previousTagNames = this.get('previousTagNames'),
                hashCurrent,
                hashPrevious;
    
            // beware! even if they have the same length,
            // that doesn't mean they're the same.
            if (tagNames.length !== previousTagNames.length) {
                return false;
            }
    
            // instead of comparing with slow, nested for loops,
            // perform join on each array and compare the strings
            hashCurrent = tagNames.join('');
            hashPrevious = previousTagNames.join('');
    
            return hashCurrent === hashPrevious;
        },
    
        // a hook created in editor-base-route's setupController
        modelSaved: function () {
            var model = this.get('model');
    
            // safer to updateTags on save in one place
            // rather than in all other places save is called
            model.updateTags();
    
            // set previousTagNames to current tagNames for isDirty check
            this.set('previousTagNames', this.get('tagNames'));
    
            // `updateTags` triggers `isDirty => true`.
            // for a saved model it would otherwise be false.
    
            // if the two "scratch" properties (title and content) match the model, then
            // it's ok to set isDirty to false
            if (model.get('titleScratch') === model.get('title') &&
                model.get('scratch') === model.get('markdown')) {
                this.set('isDirty', false);
            }
        },
    
        // an ugly hack, but necessary to watch all the model's properties
        // and more, without having to be explicit and do it manually
        isDirty: Ember.computed.apply(Ember, watchedProps.concat(function (key, value) {
            if (arguments.length > 1) {
                return value;
            }
    
            var model = this.get('model'),
                markdown = model.get('markdown'),
                title = model.get('title'),
                titleScratch = model.get('titleScratch'),
                scratch = this.getMarkdown().withoutMarkers,
                changedAttributes;
    
            if (!this.tagNamesEqual()) {
                return true;
            }
    
            if (titleScratch !== title) {
                return true;
            }
    
            // since `scratch` is not model property, we need to check
            // it explicitly against the model's markdown attribute
            if (markdown !== scratch) {
                return true;
            }
    
            // if the Adapter failed to save the model isError will be true
            // and we should consider the model still dirty.
            if (model.get('isError')) {
                return true;
            }
    
            // models created on the client always return `isDirty: true`,
            // so we need to see which properties have actually changed.
            if (model.get('isNew')) {
                changedAttributes = Ember.keys(model.changedAttributes());
    
                if (changedAttributes.length) {
                    return true;
                }
    
                return false;
            }
    
            // even though we use the `scratch` prop to show edits,
            // which does *not* change the model's `isDirty` property,
            // `isDirty` will tell us if the other props have changed,
            // as long as the model is not new (model.isNew === false).
            return model.get('isDirty');
        })),
    
        // used on window.onbeforeunload
        unloadDirtyMessage: function () {
            return '==============================\n\n' +
                'Hey there! It looks like you\'re in the middle of writing' +
                ' something and you haven\'t saved all of your content.' +
                '\n\nSave before you go!\n\n' +
                '==============================';
        },
    
        // TODO: This has to be moved to the I18n localization file.
        // This structure is supposed to be close to the i18n-localization which will be used soon.
        messageMap: {
            errors: {
                post: {
                    published: {
                        published: 'Update failed.',
                        draft: 'Saving failed.'
                    },
                    draft: {
                        published: 'Publish failed.',
                        draft: 'Saving failed.'
                    }
    
                }
            },
    
            success: {
                post: {
                    published: {
                        published: 'Updated.',
                        draft: 'Saved.'
                    },
                    draft: {
                        published: 'Published!',
                        draft: 'Saved.'
                    }
                }
            }
        },
    
        showSaveNotification: function (prevStatus, status, delay) {
            var message = this.messageMap.success.post[prevStatus][status],
                path = this.get('ghostPaths.url').join(this.get('config.blogUrl'), this.get('model.url'));
    
            if (status === 'published') {
                message += '&nbsp;<a href="' + path + '">View ' + this.get('postOrPage') + '</a>';
            }
            this.notifications.showSuccess(message, {delayed: delay});
        },
    
        showErrorNotification: function (prevStatus, status, errors, delay) {
            var message = this.messageMap.errors.post[prevStatus][status],
                error = (errors && errors[0] && errors[0].message) || 'Unknown Error';
    
            message += '<br />' + error;
    
            this.notifications.showError(message, {delayed: delay});
        },
    
        shouldFocusTitle: Ember.computed.alias('model.isNew'),
        shouldFocusEditor: Ember.computed.not('model.isNew'),
    
        actions: {
            save: function (options) {
                var status = this.get('willPublish') ? 'published' : 'draft',
                    prevStatus = this.get('model.status'),
                    isNew = this.get('model.isNew'),
                    autoSaveId = this.get('autoSaveId'),
                    timedSaveId = this.get('timedSaveId'),
                    self = this,
                    psmController = this.get('controllers.post-settings-menu'),
                    promise;
    
                options = options || {};
    
                if (autoSaveId) {
                    Ember.run.cancel(autoSaveId);
                    this.set('autoSaveId', null);
                }
    
                if (timedSaveId) {
                    Ember.run.cancel(timedSaveId);
                    this.set('timedSaveId', null);
                }
    
                self.notifications.closePassive();
    
                // ensure an incomplete tag is finalised before save
                this.get('controllers.post-tags-input').send('addNewTag');
    
                // Set the properties that are indirected
                // set markdown equal to what's in the editor, minus the image markers.
                this.set('model.markdown', this.getMarkdown().withoutMarkers);
                this.set('model.status', status);
    
                // Set a default title
                if (!this.get('model.titleScratch').trim()) {
                    this.set('model.titleScratch', '(Untitled)');
                }
    
                this.set('model.title', this.get('model.titleScratch'));
                this.set('model.meta_title', psmController.get('metaTitleScratch'));
                this.set('model.meta_description', psmController.get('metaDescriptionScratch'));
    
                if (!this.get('model.slug')) {
                    // Cancel any pending slug generation that may still be queued in the
                    // run loop because we need to run it before the post is saved.
                    Ember.run.cancel(psmController.get('debounceId'));
    
                    psmController.generateAndSetSlug('model.slug');
                }
    
                promise = Ember.RSVP.resolve(psmController.get('lastPromise')).then(function () {
                    return self.get('model').save(options).then(function (model) {
                        if (!options.silent) {
                            self.showSaveNotification(prevStatus, model.get('status'), isNew ? true : false);
                        }
    
                        return model;
                    });
                }).catch(function (errors) {
                    if (!options.silent) {
                        self.showErrorNotification(prevStatus, self.get('model.status'), errors);
                    }
    
                    self.set('model.status', prevStatus);
    
                    return self.get('model');
                });
    
                psmController.set('lastPromise', promise);
    
                return promise;
            },
    
            setSaveType: function (newType) {
                if (newType === 'publish') {
                    this.set('willPublish', true);
                } else if (newType === 'draft') {
                    this.set('willPublish', false);
                } else {
                    console.warn('Received invalid save type; ignoring.');
                }
            },
    
            // set from a `sendAction` on the codemirror component,
            // so that we get a reference for handling uploads.
            setCodeMirror: function (codemirrorComponent) {
                var codemirror = codemirrorComponent.get('codemirror');
    
                this.set('codemirrorComponent', codemirrorComponent);
                this.set('codemirror', codemirror);
            },
    
            // fired from the gh-markdown component when an image upload starts
            disableCodeMirror: function () {
                this.get('codemirrorComponent').disableCodeMirror();
            },
    
            // fired from the gh-markdown component when an image upload finishes
            enableCodeMirror: function () {
                this.get('codemirrorComponent').enableCodeMirror();
            },
    
            // Match the uploaded file to a line in the editor, and update that line with a path reference
            // ensuring that everything ends up in the correct place and format.
            handleImgUpload: function (e, resultSrc) {
                var editor = this.get('codemirror'),
                    line = this.findLine(Ember.$(e.currentTarget).attr('id')),
                    lineNumber = editor.getLineNumber(line),
                    match = line.text.match(/\([^\n]*\)?/),
                    replacement = '(http://)';
    
                if (match) {
                    // simple case, we have the parenthesis
                    editor.setSelection(
                        {line: lineNumber, ch: match.index + 1},
                        {line: lineNumber, ch: match.index + match[0].length - 1}
                    );
                } else {
                    match = line.text.match(/\]/);
                    if (match) {
                        editor.replaceRange(
                            replacement,
                            {line: lineNumber, ch: match.index + 1},
                            {line: lineNumber, ch: match.index + 1}
                        );
                        editor.setSelection(
                            {line: lineNumber, ch: match.index + 2},
                            {line: lineNumber, ch: match.index + replacement.length}
                        );
                    }
                }
    
                editor.replaceSelection(resultSrc);
            },
    
            togglePreview: function (preview) {
                this.set('isPreview', preview);
            },
    
            autoSave: function () {
                if (this.get('model.isDraft')) {
                    var autoSaveId,
                        timedSaveId;
    
                    timedSaveId = Ember.run.throttle(this, 'send', 'save', {silent: true, disableNProgress: true}, 60000, false);
                    this.set('timedSaveId', timedSaveId);
    
                    autoSaveId = Ember.run.debounce(this, 'send', 'save', {silent: true, disableNProgress: true}, 3000);
                    this.set('autoSaveId', autoSaveId);
                }
            },
    
            autoSaveNew: function () {
                if (this.get('model.isNew')) {
                    this.send('save', {silent: true, disableNProgress: true});
                }
            }
        }
    });
    
    __exports__["default"] = EditorControllerMixin;
  });
define("ghost/mixins/editor-base-route", 
  ["ghost/mixins/shortcuts-route","ghost/mixins/style-body","ghost/mixins/loading-indicator","ghost/utils/editor-shortcuts","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var ShortcutsRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    var loadingIndicator = __dependency3__["default"];

    var editorShortcuts = __dependency4__["default"];

    
    var EditorBaseRoute = Ember.Mixin.create(styleBody, ShortcutsRoute, loadingIndicator, {
        classNames: ['editor'],
    
        actions: {
            save: function () {
                this.get('controller').send('save');
            },
    
            publish: function () {
                var controller = this.get('controller');
    
                controller.send('setSaveType', 'publish');
                controller.send('save');
            },
    
            toggleZenMode: function () {
                Ember.$('body').toggleClass('zen');
            },
    
            // The actual functionality is implemented in utils/codemirror-shortcuts
            codeMirrorShortcut: function (options) {
                // Only fire editor shortcuts when the editor has focus.
                if (Ember.$('.CodeMirror.CodeMirror-focused').length > 0) {
                    this.get('controller.codemirror').shortcut(options.type);
                }
            },
    
            willTransition: function (transition) {
                var controller = this.get('controller'),
                    scratch = controller.get('model.scratch'),
                    controllerIsDirty = controller.get('isDirty'),
                    model = controller.get('model'),
                    state = model.getProperties('isDeleted', 'isSaving', 'isDirty', 'isNew'),
                    fromNewToEdit,
                    deletedWithoutChanges;
    
                fromNewToEdit = this.get('routeName') === 'editor.new' &&
                    transition.targetName === 'editor.edit' &&
                    transition.intent.contexts &&
                    transition.intent.contexts[0] &&
                    transition.intent.contexts[0].id === model.get('id');
    
                deletedWithoutChanges = state.isDeleted &&
                    (state.isSaving || !state.isDirty);
    
                this.send('closeSettingsMenu');
    
                if (!fromNewToEdit && !deletedWithoutChanges && controllerIsDirty) {
                    transition.abort();
                    this.send('openModal', 'leave-editor', [controller, transition]);
                    return;
                }
    
                // The controller may hold model state that will be lost in the transition,
                // so we need to apply it now.
                if (fromNewToEdit && controllerIsDirty) {
                    if (scratch !== model.get('markdown')) {
                        model.set('markdown', scratch);
                    }
                }
    
                if (state.isNew) {
                    model.deleteRecord();
                }
    
                // since the transition is now certain to complete..
                window.onbeforeunload = null;
    
                // remove model-related listeners created in editor-base-route
                this.detachModelHooks(controller, model);
            }
        },
    
        renderTemplate: function (controller, model) {
            this._super(controller, model);
    
            this.render('post-settings-menu', {
                into: 'application',
                outlet: 'settings-menu',
                model: model
            });
        },
    
        shortcuts: editorShortcuts,
    
        attachModelHooks: function (controller, model) {
            // this will allow us to track when the model is saved and update the controller
            // so that we can be sure controller.isDirty is correct, without having to update the
            // controller on each instance of `model.save()`.
            //
            // another reason we can't do this on `model.save().then()` is because the post-settings-menu
            // also saves the model, and passing messages is difficult because we have two
            // types of editor controllers, and the PSM also exists on the posts.post route.
            //
            // The reason we can't just keep this functionality in the editor controller is
            // because we need to remove these handlers on `willTransition` in the editor route.
            model.on('didCreate', controller, controller.get('modelSaved'));
            model.on('didUpdate', controller, controller.get('modelSaved'));
        },
    
        detachModelHooks: function (controller, model) {
            model.off('didCreate', controller, controller.get('modelSaved'));
            model.off('didUpdate', controller, controller.get('modelSaved'));
        },
    
        setupController: function (controller, model) {
            this._super(controller, model);
            var tags = model.get('tags');
    
            controller.set('model.scratch', model.get('markdown'));
    
            controller.set('model.titleScratch', model.get('title'));
    
            if (tags) {
                // used to check if anything has changed in the editor
                controller.set('previousTagNames', tags.mapBy('name'));
            } else {
                controller.set('previousTagNames', []);
            }
    
            // attach model-related listeners created in editor-base-route
            this.attachModelHooks(controller, model);
        }
    });
    
    __exports__["default"] = EditorBaseRoute;
  });
define("ghost/mixins/editor-base-view", 
  ["ghost/utils/set-scroll-classname","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var setScrollClassName = __dependency1__["default"];

    
    var EditorViewMixin = Ember.Mixin.create({
        // create a hook for jQuery logic that will run after
        // a view and all child views have been rendered,
        // since didInsertElement runs only when the view's el
        // has rendered, and not necessarily all child views.
        //
        // http://mavilein.github.io/javascript/2013/08/01/Ember-JS-After-Render-Event/
        // http://emberjs.com/api/classes/Ember.run.html#method_next
        scheduleAfterRender: function () {
            Ember.run.scheduleOnce('afterRender', this, this.afterRenderEvent);
        }.on('didInsertElement'),
    
        // all child views will have rendered when this fires
        afterRenderEvent: function () {
            var $previewViewPort = this.$('.js-entry-preview-content');
    
            // cache these elements for use in other methods
            this.set('$previewViewPort', $previewViewPort);
            this.set('$previewContent', this.$('.js-rendered-markdown'));
    
            $previewViewPort.scroll(Ember.run.bind($previewViewPort, setScrollClassName, {
                target: this.$('.js-entry-preview'),
                offset: 10
            }));
        },
    
        removeScrollHandlers: function () {
            this.get('$previewViewPort').off('scroll');
        }.on('willDestroyElement'),
    
        // updated when gh-codemirror component scrolls
        markdownScrollInfo: null,
    
        // percentage of scroll position to set htmlPreview
        scrollPosition: Ember.computed('markdownScrollInfo', function () {
            if (!this.get('markdownScrollInfo')) {
                return 0;
            }
    
            var scrollInfo = this.get('markdownScrollInfo'),
                markdownHeight,
                previewHeight,
                ratio;
    
            markdownHeight = scrollInfo.height - scrollInfo.clientHeight;
            previewHeight = this.get('$previewContent').height() - this.get('$previewViewPort').height();
    
            ratio = previewHeight / markdownHeight;
    
            return scrollInfo.top * ratio;
        })
    });
    
    __exports__["default"] = EditorViewMixin;
  });
define("ghost/mixins/loading-indicator", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // mixin used for routes to display a loading indicator when there is network activity
    var loaderOptions,
        loadingIndicator;
    
    loaderOptions = {
        showSpinner: false
    };
    
    NProgress.configure(loaderOptions);
    
    loadingIndicator = Ember.Mixin.create({
        actions:  {
    
            loading: function () {
                NProgress.start();
                this.router.one('didTransition', function () {
                    NProgress.done();
                });
    
                return true;
            },
    
            error: function () {
                NProgress.done();
    
                return true;
            }
        }
    });
    
    __exports__["default"] = loadingIndicator;
  });
define("ghost/mixins/marker-manager", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var MarkerManager = Ember.Mixin.create({
        imageMarkdownRegex: /^(?:\{<(.*?)>\})?!(?:\[([^\n\]]*)\])(?:\(([^\n\]]*)\))?$/gim,
        markerRegex: /\{<([\w\W]*?)>\}/,
    
        uploadId: 1,
    
        // create an object that will be shared amongst instances.
        // makes it easier to use helper functions in different modules
        markers: {},
    
        // Add markers to the line if it needs one
        initMarkers: function (line) {
            var imageMarkdownRegex = this.get('imageMarkdownRegex'),
                markerRegex = this.get('markerRegex'),
                editor = this.get('codemirror'),
                isImage = line.text.match(imageMarkdownRegex),
                hasMarker = line.text.match(markerRegex);
    
            if (isImage && !hasMarker) {
                this.addMarker(line, editor.getLineNumber(line));
            }
        },
    
        // Get the markdown with all the markers stripped
        getMarkdown: function (value) {
            var marker, id,
                editor = this.get('codemirror'),
                markers = this.get('markers'),
                markerRegexForId = this.get('markerRegexForId'),
                oldValue = value || editor.getValue(),
                newValue = oldValue;
    
            for (id in markers) {
                if (markers.hasOwnProperty(id)) {
                    marker = markers[id];
                    newValue = newValue.replace(markerRegexForId(id), '');
                }
            }
    
            return {
                withMarkers: oldValue,
                withoutMarkers: newValue
            };
        },
    
        // check the given line to see if it has an image, and if it correctly has a marker
        // in the special case of lines which were just pasted in, any markers are removed to prevent duplication
        checkLine: function (ln, mode) {
            var editor = this.get('codemirror'),
                line = editor.getLineHandle(ln),
                imageMarkdownRegex = this.get('imageMarkdownRegex'),
                markerRegex = this.get('markerRegex'),
                isImage = line.text.match(imageMarkdownRegex),
                hasMarker;
    
            // We care if it is an image
            if (isImage) {
                hasMarker = line.text.match(markerRegex);
    
                if (hasMarker && (mode === 'paste' || mode === 'undo')) {
                    // this could be a duplicate, and won't be a real marker
                    this.stripMarkerFromLine(line);
                }
    
                if (!hasMarker) {
                    this.addMarker(line, ln);
                }
            }
            // TODO: hasMarker but no image?
        },
    
        // Add a marker to the given line
        // Params:
        // line - CodeMirror LineHandle
        // ln - line number
        addMarker: function (line, ln) {
            var marker,
                markers = this.get('markers'),
                editor = this.get('codemirror'),
                uploadPrefix = 'image_upload',
                uploadId = this.get('uploadId'),
                magicId = '{<' + uploadId + '>}',
                newText = magicId + line.text;
    
            editor.replaceRange(
                newText,
                {line: ln, ch: 0},
                {line: ln, ch: newText.length}
            );
    
            marker = editor.markText(
                {line: ln, ch: 0},
                {line: ln, ch: (magicId.length)},
                {collapsed: true}
            );
    
            markers[uploadPrefix + '_' + uploadId] = marker;
            this.set('uploadId', uploadId += 1);
        },
    
        // Check each marker to see if it is still present in the editor and if it still corresponds to image markdown
        // If it is no longer a valid image, remove it
        checkMarkers: function () {
            var id, marker, line,
                editor = this.get('codemirror'),
                markers = this.get('markers'),
                imageMarkdownRegex = this.get('imageMarkdownRegex');
    
            for (id in markers) {
                if (markers.hasOwnProperty(id)) {
                    marker = markers[id];
    
                    if (marker.find()) {
                        line = editor.getLineHandle(marker.find().from.line);
                        if (!line.text.match(imageMarkdownRegex)) {
                            this.removeMarker(id, marker, line);
                        }
                    } else {
                        this.removeMarker(id, marker);
                    }
                }
            }
        },
    
        // this is needed for when we transition out of the editor.
        // since the markers object is persistent and shared between classes that
        // mix in this mixin, we need to make sure markers don't carry over between edits.
        clearMarkers: function () {
            var markers = this.get('markers'),
                id,
                marker;
    
            // can't just `this.set('markers', {})`,
            // since it wouldn't apply to this mixin,
            // but only to the class that mixed this mixin in
            for (id in markers) {
                if (markers.hasOwnProperty(id)) {
                    marker = markers[id];
                    delete markers[id];
                    marker.clear();
                }
            }
        },
    
        // Remove a marker
        // Will be passed a LineHandle if we already know which line the marker is on
        removeMarker: function (id, marker, line) {
            var markers = this.get('markers');
    
            delete markers[id];
            marker.clear();
    
            if (line) {
                this.stripMarkerFromLine(line);
            } else {
                this.findAndStripMarker(id);
            }
        },
    
        // Removes the marker on the given line if there is one
        stripMarkerFromLine: function (line) {
            var editor = this.get('codemirror'),
                ln = editor.getLineNumber(line),
    
                markerRegex = /\{<([\w\W]*?)>\}/,
    
                markerText = line.text.match(markerRegex);
    
            if (markerText) {
                editor.replaceRange(
                    '',
                    {line: ln, ch: markerText.index},
                    {line: ln, ch: markerText.index + markerText[0].length}
                );
            }
        },
    
        // the regex
        markerRegexForId: function (id) {
            id = id.replace('image_upload_', '');
            return new RegExp('\\{<' + id + '>\\}', 'gmi');
        },
    
        // Find a marker in the editor by id & remove it
        // Goes line by line to find the marker by it's text if we've lost track of the TextMarker
        findAndStripMarker: function (id) {
            var self = this,
                editor = this.get('codemirror');
    
            editor.eachLine(function (line) {
                var markerText = self.markerRegexForId(id).exec(line.text),
                    ln;
    
                if (markerText) {
                    ln = editor.getLineNumber(line);
                    editor.replaceRange(
                        '',
                        {line: ln, ch: markerText.index},
                        {line: ln, ch: markerText.index + markerText[0].length}
                    );
                }
            });
        },
    
        // Find the line with the marker which matches
        findLine: function (resultId) {
            var editor = this.get('codemirror'),
                markers = this.get('markers');
    
            // try to find the right line to replace
            if (markers.hasOwnProperty(resultId) && markers[resultId].find()) {
                return editor.getLineHandle(markers[resultId].find().from.line);
            }
    
            return false;
        }
    });
    
    __exports__["default"] = MarkerManager;
  });
define("ghost/mixins/nprogress-save", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NProgressSaveMixin = Ember.Mixin.create({
        save: function (options) {
            if (options && options.disableNProgress) {
                return this._super(options);
            }
    
            NProgress.start();
    
            return this._super(options).then(function (value) {
                NProgress.done();
    
                return value;
            }).catch(function (error) {
                NProgress.done();
    
                return Ember.RSVP.reject(error);
            });
        }
    });
    
    __exports__["default"] = NProgressSaveMixin;
  });
define("ghost/mixins/pagination-controller", 
  ["ghost/utils/ajax","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var getRequestErrorMessage = __dependency1__.getRequestErrorMessage;

    
    var PaginationControllerMixin = Ember.Mixin.create({
        // set from PaginationRouteMixin
        paginationSettings: null,
    
        // indicates whether we're currently loading the next page
        isLoading: null,
    
        /**
         * Takes an ajax response, concatenates any error messages, then generates an error notification.
         * @param {jqXHR} response The jQuery ajax reponse object.
         * @return
         */
        reportLoadError: function (response) {
            var message = 'A problem was encountered while loading more records';
    
            if (response) {
                // Get message from response
                message += ': ' + getRequestErrorMessage(response, true);
            } else {
                message += '.';
            }
    
            this.notifications.showError(message);
        },
    
        actions: {
            /**
             * Loads the next paginated page of posts into the ember-data store. Will cause the posts list UI to update.
             * @return
             */
            loadNextPage: function () {
                var self = this,
                    store = this.get('store'),
                    recordType = this.get('model').get('type'),
                    metadata = this.store.metadataFor(recordType),
                    nextPage = metadata.pagination && metadata.pagination.next,
                    paginationSettings = this.get('paginationSettings');
    
                if (nextPage) {
                    this.set('isLoading', true);
                    this.set('paginationSettings.page', nextPage);
    
                    store.find(recordType, paginationSettings).then(function () {
                        self.set('isLoading', false);
                    }, function (response) {
                        self.reportLoadError(response);
                    });
                }
            },
    
            resetPagination: function () {
                this.set('paginationSettings.page', 1);
                this.store.metaForType('tag', {pagination: undefined});
            }
        }
    });
    
    __exports__["default"] = PaginationControllerMixin;
  });
define("ghost/mixins/pagination-route", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var defaultPaginationSettings,
        PaginationRoute;
    
    defaultPaginationSettings = {
        page: 1,
        limit: 15
    };
    
    PaginationRoute = Ember.Mixin.create({
        /**
         * Sets up pagination details
         * @param {object} settings specifies additional pagination details
         */
        setupPagination: function (settings) {
            settings = settings || {};
            for (var key in defaultPaginationSettings) {
                if (defaultPaginationSettings.hasOwnProperty(key)) {
                    if (!settings.hasOwnProperty(key)) {
                        settings[key] = defaultPaginationSettings[key];
                    }
                }
            }
    
            this.set('paginationSettings', settings);
            this.controller.set('paginationSettings', settings);
        }
    });
    
    __exports__["default"] = PaginationRoute;
  });
define("ghost/mixins/pagination-view-infinite-scroll", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PaginationViewInfiniteScrollMixin = Ember.Mixin.create({
    
        /**
         * Determines if we are past a scroll point where we need to fetch the next page
         * @param {object} event The scroll event
         */
        checkScroll: function (event) {
            var element = event.target,
                triggerPoint = 100,
                controller = this.get('controller'),
                isLoading = controller.get('isLoading');
    
            // If we haven't passed our threshold or we are already fetching content, exit
            if (isLoading || (element.scrollTop + element.clientHeight + triggerPoint <= element.scrollHeight)) {
                return;
            }
    
            controller.send('loadNextPage');
        },
    
        /**
         * Bind to the scroll event once the element is in the DOM
         */
        attachCheckScroll: function () {
            var el = this.$(),
                controller = this.get('controller');
    
            el.on('scroll', Ember.run.bind(this, this.checkScroll));
    
            if (this.element.scrollHeight <= this.element.clientHeight) {
                controller.send('loadNextPage');
            }
        }.on('didInsertElement'),
    
        /**
         * Unbind from the scroll event when the element is no longer in the DOM
         */
        detachCheckScroll: function () {
            var el = this.$();
            el.off('scroll');
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = PaginationViewInfiniteScrollMixin;
  });
define("ghost/mixins/selective-save", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // SelectiveSaveMixin adds a saveOnly method to a DS.Model.
    //
    // saveOnly provides a way to save one or more properties of a model while
    // preserving outstanding changes to other properties.
    var SelectiveSaveMixin = Ember.Mixin.create({
        saveOnly: function () {
            if (arguments.length === 0) {
                return Ember.RSVP.resolve();
            }
    
            if (arguments.length === 1 && Ember.isArray(arguments[0])) {
                return this.saveOnly.apply(this, Array.prototype.slice.call(arguments[0]));
            }
    
            var propertiesToSave = Array.prototype.slice.call(arguments),
                changed,
                hasMany = {},
                belongsTo = {},
                self = this;
    
            changed = this.changedAttributes();
    
            // disable observers so we can make changes to the model but not have
            // them reflected by the UI
            this.beginPropertyChanges();
    
            // make a copy of any relations the model may have so they can
            // be reapplied later
            this.eachRelationship(function (name, meta) {
                if (meta.kind === 'hasMany') {
                    hasMany[name] = self.get(name).slice();
                    return;
                }
    
                if (meta.kind === 'belongsTo') {
                    belongsTo[name] = self.get(name);
                    return;
                }
            });
    
            try {
                // roll back all changes to the model and then reapply only those that
                // are part of the saveOnly
    
                self.rollback();
    
                propertiesToSave.forEach(function (name) {
                    if (hasMany.hasOwnProperty(name)) {
                        self.get(name).clear();
    
                        hasMany[name].forEach(function (relatedType) {
                            self.get(name).pushObject(relatedType);
                        });
    
                        return;
                    }
    
                    if (belongsTo.hasOwnProperty(name)) {
                        return self.updateBelongsTo(name, belongsTo[name]);
                    }
    
                    if (changed.hasOwnProperty(name)) {
                        return self.set(name, changed[name][1]);
                    }
                });
            }
            catch (err) {
                // if we were not able to get the model into the correct state
                // put it back the way we found it and return a rejected promise
    
                Ember.keys(changed).forEach(function (name) {
                    self.set(name, changed[name][1]);
                });
    
                Ember.keys(hasMany).forEach(function (name) {
                    self.updateHasMany(name, hasMany[name]);
                });
    
                Ember.keys(belongsTo).forEach(function (name) {
                    self.updateBelongsTo(name, belongsTo[name]);
                });
    
                self.endPropertyChanges();
    
                return Ember.RSVP.reject(new Error(err.message || 'Error during saveOnly. Changes NOT saved.'));
            }
    
            return this.save().finally(function () {
                // reapply any changes that were not part of the save
    
                Ember.keys(changed).forEach(function (name) {
                    if (propertiesToSave.hasOwnProperty(name)) {
                        return;
                    }
    
                    self.set(name, changed[name][1]);
                });
    
                Ember.keys(hasMany).forEach(function (name) {
                    if (propertiesToSave.hasOwnProperty(name)) {
                        return;
                    }
    
                    self.updateHasMany(name, hasMany[name]);
                });
    
                Ember.keys(belongsTo).forEach(function (name) {
                    if (propertiesToSave.hasOwnProperty(name)) {
                        return;
                    }
    
                    self.updateBelongsTo(name, belongsTo[name]);
                });
    
                // signal that we're finished and normal model observation may continue
                self.endPropertyChanges();
            });
        }
    });
    
    __exports__["default"] = SelectiveSaveMixin;
  });
define("ghost/mixins/settings-menu-controller", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingsMenuControllerMixin = Ember.Mixin.create({
        needs: 'application',
    
        isViewingSubview: Ember.computed('controllers.application.showSettingsMenu', function (key, value) {
            // Not viewing a subview if we can't even see the PSM
            if (!this.get('controllers.application.showSettingsMenu')) {
                return false;
            }
            if (arguments.length > 1) {
                return value;
            }
    
            return false;
        }),
    
        actions: {
            showSubview: function () {
                this.set('isViewingSubview', true);
            },
    
            closeSubview: function () {
                this.set('isViewingSubview', false);
            }
        }
    });
    
    __exports__["default"] = SettingsMenuControllerMixin;
  });
define("ghost/mixins/shortcuts-route", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /* global key */
    
    // Configure KeyMaster to respond to all shortcuts,
    // even inside of
    // input, textarea, and select.
    key.filter = function () {
        return true;
    };
    
    key.setScope('default');
    /**
     * Only routes can implement shortcuts.
     * If you need to trigger actions on the controller,
     * simply call them with `this.get('controller').send('action')`.
     *
     * To implement shortcuts, add this mixin to your `extend()`,
     * and implement a `shortcuts` hash.
     * In this hash, keys are shortcut combinations and values are route action names.
     *  (see [keymaster docs](https://github.com/madrobby/keymaster/blob/master/README.markdown)),
     *
     * ```javascript
     * shortcuts: {
     *     'ctrl+s, command+s': 'save',
     *     'ctrl+alt+z': 'toggleZenMode'
     * }
     * ```
     * For more complex actions, shortcuts can instead have their value
     * be an object like {action, options}
     * ```javascript
     * shortcuts: {
     *      'ctrl+k': {action: 'markdownShortcut', options: 'createLink'}
     * }
     * ```
     * You can set the scope of your shortcut by passing a scope property.
     * ```javascript
     * shortcuts : {
     *   'enter': {action : 'confirmModal', scope: 'modal'}
     * }
     * ```
     * If you don't specify a scope, we use a default scope called "default".
     * To have all your shortcut work in all scopes, give it the scope "all".
     * Find out more at the keymaster docs
     */
    var ShortcutsRoute = Ember.Mixin.create({
        registerShortcuts: function () {
            var self = this,
                shortcuts = this.get('shortcuts');
    
            Ember.keys(shortcuts).forEach(function (shortcut) {
                var scope = shortcuts[shortcut].scope || 'default',
                    action = shortcuts[shortcut],
                    options;
    
                if (Ember.typeOf(action) !== 'string') {
                    options = action.options;
                    action = action.action;
                }
    
                key(shortcut, scope, function (event) {
                    // stop things like ctrl+s from actually opening a save dialogue
                    event.preventDefault();
                    self.send(action, options);
                });
            });
        },
    
        removeShortcuts: function () {
            var shortcuts = this.get('shortcuts');
    
            Ember.keys(shortcuts).forEach(function (shortcut) {
                key.unbind(shortcut);
            });
        },
    
        activate: function () {
            this._super();
            this.registerShortcuts();
        },
    
        deactivate: function () {
            this._super();
            this.removeShortcuts();
        }
    });
    
    __exports__["default"] = ShortcutsRoute;
  });
define("ghost/mixins/style-body", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // mixin used for routes that need to set a css className on the body tag
    
    var styleBody = Ember.Mixin.create({
        activate: function () {
            this._super();
    
            var cssClasses = this.get('classNames');
    
            if (cssClasses) {
                Ember.run.schedule('afterRender', null, function () {
                    cssClasses.forEach(function (curClass) {
                        Ember.$('body').addClass(curClass);
                    });
                });
            }
        },
    
        deactivate: function () {
            this._super();
    
            var cssClasses = this.get('classNames');
    
            Ember.run.schedule('afterRender', null, function () {
                cssClasses.forEach(function (curClass) {
                    Ember.$('body').removeClass(curClass);
                });
            });
        }
    });
    
    __exports__["default"] = styleBody;
  });
define("ghost/mixins/text-input", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var BlurField = Ember.Mixin.create({
        selectOnClick: false,
        stopEnterKeyDownPropagation: false,
    
        click: function (event) {
            if (this.get('selectOnClick')) {
                event.currentTarget.select();
            }
        },
    
        keyDown: function (event) {
            // stop event propagation when pressing "enter"
            // most useful in the case when undesired (global) keyboard shortcuts are getting triggered while interacting
            // with this particular input element.
            if (this.get('stopEnterKeyDownPropagation') && event.keyCode === 13) {
                event.stopPropagation();
    
                return true;
            }
        }
    });
    
    __exports__["default"] = BlurField;
  });
define("ghost/mixins/validation-engine", 
  ["ghost/utils/ajax","ghost/utils/validator-extensions","ghost/validators/post","ghost/validators/setup","ghost/validators/signup","ghost/validators/signin","ghost/validators/forgotten","ghost/validators/setting","ghost/validators/reset","ghost/validators/user","ghost/validators/tag-settings","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __dependency9__, __dependency10__, __dependency11__, __exports__) {
    "use strict";
    var getRequestErrorMessage = __dependency1__.getRequestErrorMessage;

    
    var ValidatorExtensions = __dependency2__["default"];

    var PostValidator = __dependency3__["default"];

    var SetupValidator = __dependency4__["default"];

    var SignupValidator = __dependency5__["default"];

    var SigninValidator = __dependency6__["default"];

    var ForgotValidator = __dependency7__["default"];

    var SettingValidator = __dependency8__["default"];

    var ResetValidator = __dependency9__["default"];

    var UserValidator = __dependency10__["default"];

    var TagSettingsValidator = __dependency11__["default"];

    
    // our extensions to the validator library
    ValidatorExtensions.init();
    
    // format errors to be used in `notifications.showErrors`.
    // result is [{message: 'concatenated error messages'}]
    function formatErrors(errors, opts) {
        var message = 'There was an error';
    
        opts = opts || {};
    
        if (opts.wasSave && opts.validationType) {
            message += ' saving this ' + opts.validationType;
        }
    
        if (Ember.isArray(errors)) {
            // get the validator's error messages from the array.
            // normalize array members to map to strings.
            message = errors.map(function (error) {
                if (typeof error === 'string') {
                    return error;
                }
    
                return error.message;
            }).join('<br />');
        } else if (errors instanceof Error) {
            message += errors.message || '.';
        } else if (typeof errors === 'object') {
            // Get messages from server response
            message += ': ' + getRequestErrorMessage(errors, true);
        } else if (typeof errors === 'string') {
            message += ': ' + errors;
        } else {
            message += '.';
        }
    
        // set format for notifications.showErrors
        message = [{message: message}];
    
        return message;
    }
    
    /**
    * The class that gets this mixin will receive these properties and functions.
    * It will be able to validate any properties on itself (or the model it passes to validate())
    * with the use of a declared validator.
    */
    var ValidationEngine = Ember.Mixin.create({
        // these validators can be passed a model to validate when the class that
        // mixes in the ValidationEngine declares a validationType equal to a key on this object.
        // the model is either passed in via `this.validate({ model: object })`
        // or by calling `this.validate()` without the model property.
        // in that case the model will be the class that the ValidationEngine
        // was mixed into, i.e. the controller or Ember Data model.
        validators: {
            post: PostValidator,
            setup: SetupValidator,
            signup: SignupValidator,
            signin: SigninValidator,
            forgotten: ForgotValidator,
            setting: SettingValidator,
            reset: ResetValidator,
            user: UserValidator,
            tag: TagSettingsValidator
        },
    
        /**
        * Passses the model to the validator specified by validationType.
        * Returns a promise that will resolve if validation succeeds, and reject if not.
        * Some options can be specified:
        *
        * `format: false` - doesn't use formatErrors to concatenate errors for notifications.showErrors.
        *                   will return whatever the specified validator returns.
        *                   since notifications are a common usecase, `format` is true by default.
        *
        * `model: Object` - you can specify the model to be validated, rather than pass the default value of `this`,
        *                   the class that mixes in this mixin.
        */
        validate: function (opts) {
            // jscs:disable safeContextKeyword
            opts = opts || {};
    
            var model = this,
                type,
                validator;
    
            if (opts.model) {
                model = opts.model;
            } else if (this instanceof DS.Model) {
                model = this;
            } else if (this.get('model')) {
                model = this.get('model');
            }
    
            type = this.get('validationType') || model.get('validationType');
            validator = this.get('validators.' + type) || model.get('validators.' + type);
    
            opts.validationType = type;
    
            return new Ember.RSVP.Promise(function (resolve, reject) {
                var validationErrors;
    
                if (!type || !validator) {
                    validationErrors = ['The validator specified, "' + type + '", did not exist!'];
                } else {
                    validationErrors = validator.check(model);
                }
    
                if (Ember.isEmpty(validationErrors)) {
                    return resolve();
                }
    
                if (opts.format !== false) {
                    validationErrors = formatErrors(validationErrors, opts);
                }
    
                return reject(validationErrors);
            });
        },
    
        /**
        * The primary goal of this method is to override the `save` method on Ember Data models.
        * This allows us to run validation before actually trying to save the model to the server.
        * You can supply options to be passed into the `validate` method, since the ED `save` method takes no options.
        */
        save: function (options) {
            var self = this,
                // this is a hack, but needed for async _super calls.
                // ref: https://github.com/emberjs/ember.js/pull/4301
                _super = this.__nextSuper;
    
            options = options || {};
            options.wasSave = true;
    
            // model.destroyRecord() calls model.save() behind the scenes.
            // in that case, we don't need validation checks or error propagation,
            // because the model itself is being destroyed.
            if (this.get('isDeleted')) {
                return this._super();
            }
    
            // If validation fails, reject with validation errors.
            // If save to the server fails, reject with server response.
            return this.validate(options).then(function () {
                return _super.call(self, options);
            }).catch(function (result) {
                // server save failed - validate() would have given back an array
                if (!Ember.isArray(result)) {
                    if (options.format !== false) {
                        // concatenate all errors into an array with a single object: [{message: 'concatted message'}]
                        result = formatErrors(result, options);
                    } else {
                        // return the array of errors from the server
                        result = getRequestErrorMessage(result);
                    }
                }
    
                return Ember.RSVP.reject(result);
            });
        }
    });
    
    __exports__["default"] = ValidationEngine;
  });
define("ghost/models/notification", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var Notification = DS.Model.extend({
        dismissible: DS.attr('boolean'),
        location: DS.attr('string'),
        status: DS.attr('string'),
        type: DS.attr('string'),
        message: DS.attr('string')
    });
    
    __exports__["default"] = Notification;
  });
define("ghost/models/post", 
  ["ghost/mixins/validation-engine","ghost/mixins/nprogress-save","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    var NProgressSaveMixin = __dependency2__["default"];

    
    var Post = DS.Model.extend(NProgressSaveMixin, ValidationEngine, {
        validationType: 'post',
    
        uuid: DS.attr('string'),
        title: DS.attr('string', {defaultValue: ''}),
        slug: DS.attr('string'),
        markdown: DS.attr('string', {defaultValue: ''}),
        html: DS.attr('string'),
        image: DS.attr('string'),
        featured: DS.attr('boolean', {defaultValue: false}),
        page: DS.attr('boolean', {defaultValue: false}),
        status: DS.attr('string', {defaultValue: 'draft'}),
        language: DS.attr('string', {defaultValue: 'en_US'}),
        meta_title: DS.attr('string'),
        meta_description: DS.attr('string'),
        author: DS.belongsTo('user',  {async: true}),
        author_id: DS.attr('number'),
        updated_at: DS.attr('moment-date'),
        updated_by: DS.attr(),
        published_at: DS.attr('moment-date'),
        published_by: DS.belongsTo('user', {async: true}),
        created_at: DS.attr('moment-date'),
        created_by: DS.attr(),
        tags: DS.hasMany('tag', {embedded: 'always'}),
        url: DS.attr('string'),
    
        scratch: null,
        titleScratch: null,
    
        // Computed post properties
    
        isPublished: Ember.computed.equal('status', 'published'),
        isDraft: Ember.computed.equal('status', 'draft'),
    
        // remove client-generated tags, which have `id: null`.
        // Ember Data won't recognize/update them automatically
        // when returned from the server with ids.
        updateTags: function () {
            var tags = this.get('tags'),
                oldTags = tags.filterBy('id', null);
    
            tags.removeObjects(oldTags);
            oldTags.invoke('deleteRecord');
        },
    
        isAuthoredByUser: function (user) {
            return parseInt(user.get('id'), 10) === parseInt(this.get('author_id'), 10);
        }
    
    });
    
    __exports__["default"] = Post;
  });
define("ghost/models/role", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var Role = DS.Model.extend({
        uuid: DS.attr('string'),
        name: DS.attr('string'),
        description: DS.attr('string'),
        created_at: DS.attr('moment-date'),
        updated_at: DS.attr('moment-date'),
        created_by: DS.attr(),
        updated_by: DS.attr(),
    
        lowerCaseName: Ember.computed('name', function () {
            return this.get('name').toLocaleLowerCase();
        })
    });
    
    __exports__["default"] = Role;
  });
define("ghost/models/setting", 
  ["ghost/mixins/validation-engine","ghost/mixins/nprogress-save","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    var NProgressSaveMixin = __dependency2__["default"];

    
    var Setting = DS.Model.extend(NProgressSaveMixin, ValidationEngine, {
        validationType: 'setting',
    
        title: DS.attr('string'),
        description: DS.attr('string'),
        email: DS.attr('string'),
        logo: DS.attr('string'),
        cover: DS.attr('string'),
        defaultLang: DS.attr('string'),
        postsPerPage: DS.attr('number'),
        forceI18n: DS.attr('boolean'),
        permalinks: DS.attr('string'),
        activeTheme: DS.attr('string'),
        availableThemes: DS.attr(),
        ghost_head: DS.attr('string'),
        ghost_foot: DS.attr('string'),
        labs: DS.attr('string'),
        navigation: DS.attr('string')
    });
    
    __exports__["default"] = Setting;
  });
define("ghost/models/slug-generator", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SlugGenerator = Ember.Object.extend({
        ghostPaths: null,
        slugType: null,
        value: null,
        toString: function () {
            return this.get('value');
        },
        generateSlug: function (textToSlugify) {
            var self = this,
                url;
    
            if (!textToSlugify) {
                return Ember.RSVP.resolve('');
            }
    
            url = this.get('ghostPaths.url').api('slugs', this.get('slugType'), encodeURIComponent(textToSlugify));
    
            return ic.ajax.request(url, {
                type: 'GET'
            }).then(function (response) {
                var slug = response.slugs[0].slug;
                self.set('value', slug);
                return slug;
            });
        }
    });
    
    __exports__["default"] = SlugGenerator;
  });
define("ghost/models/tag", 
  ["ghost/mixins/validation-engine","ghost/mixins/nprogress-save","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    var NProgressSaveMixin = __dependency2__["default"];

    
    var Tag = DS.Model.extend(NProgressSaveMixin, ValidationEngine, {
        validationType: 'tag',
    
        uuid: DS.attr('string'),
        name: DS.attr('string'),
        slug: DS.attr('string'),
        description: DS.attr('string'),
        parent: DS.attr(),
        meta_title: DS.attr('string'),
        meta_description: DS.attr('string'),
        image: DS.attr('string'),
        hidden: DS.attr('boolean'),
        created_at: DS.attr('moment-date'),
        updated_at: DS.attr('moment-date'),
        created_by: DS.attr(),
        updated_by: DS.attr(),
        post_count: DS.attr('number')
    });
    
    __exports__["default"] = Tag;
  });
define("ghost/models/user", 
  ["ghost/mixins/validation-engine","ghost/mixins/nprogress-save","ghost/mixins/selective-save","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var ValidationEngine = __dependency1__["default"];

    var NProgressSaveMixin = __dependency2__["default"];

    var SelectiveSaveMixin = __dependency3__["default"];

    
    var User = DS.Model.extend(NProgressSaveMixin, SelectiveSaveMixin, ValidationEngine, {
        validationType: 'user',
    
        uuid: DS.attr('string'),
        name: DS.attr('string'),
        slug: DS.attr('string'),
        email: DS.attr('string'),
        image: DS.attr('string'),
        cover: DS.attr('string'),
        bio: DS.attr('string'),
        website: DS.attr('string'),
        location: DS.attr('string'),
        accessibility: DS.attr('string'),
        status: DS.attr('string'),
        language: DS.attr('string', {defaultValue: 'en_US'}),
        meta_title: DS.attr('string'),
        meta_description: DS.attr('string'),
        last_login: DS.attr('moment-date'),
        created_at: DS.attr('moment-date'),
        created_by: DS.attr('number'),
        updated_at: DS.attr('moment-date'),
        updated_by: DS.attr('number'),
        roles: DS.hasMany('role', {embedded: 'always'}),
    
        role: Ember.computed('roles', function (name, value) {
            if (arguments.length > 1) {
                // Only one role per user, so remove any old data.
                this.get('roles').clear();
                this.get('roles').pushObject(value);
    
                return value;
            }
    
            return this.get('roles.firstObject');
        }),
    
        // TODO: Once client-side permissions are in place,
        // remove the hard role check.
        isAuthor: Ember.computed.equal('role.name', 'Author'),
        isEditor: Ember.computed.equal('role.name', 'Editor'),
        isAdmin: Ember.computed.equal('role.name', 'Administrator'),
        isOwner: Ember.computed.equal('role.name', 'Owner'),
    
        saveNewPassword: function () {
            var url = this.get('ghostPaths.url').api('users', 'password');
    
            return ic.ajax.request(url, {
                type: 'PUT',
                data: {
                    password: [{
                        user_id: this.get('id'),
                        oldPassword: this.get('password'),
                        newPassword: this.get('newPassword'),
                        ne2Password: this.get('ne2Password')
                    }]
                }
            });
        },
    
        resendInvite: function () {
            var fullUserData = this.toJSON(),
                userData = {
                    email: fullUserData.email,
                    roles: fullUserData.roles
                };
    
            return ic.ajax.request(this.get('ghostPaths.url').api('users'), {
                type: 'POST',
                data: JSON.stringify({users: [userData]}),
                contentType: 'application/json'
            });
        },
    
        passwordValidationErrors: Ember.computed('password', 'newPassword', 'ne2Password', function () {
            var validationErrors = [];
    
            if (!validator.equals(this.get('newPassword'), this.get('ne2Password'))) {
                validationErrors.push({message: 'Your new passwords do not match'});
            }
    
            if (!validator.isLength(this.get('newPassword'), 8)) {
                validationErrors.push({message: 'Your password is not long enough. It must be at least 8 characters long.'});
            }
    
            return validationErrors;
        }),
    
        isPasswordValid: Ember.computed.empty('passwordValidationErrors.[]'),
    
        active: function () {
            return ['active', 'warn-1', 'warn-2', 'warn-3', 'warn-4', 'locked'].indexOf(this.get('status')) > -1;
        }.property('status'),
    
        invited: function () {
            return ['invited', 'invited-pending'].indexOf(this.get('status')) > -1;
        }.property('status'),
    
        pending: Ember.computed.equal('status', 'invited-pending').property('status')
    });
    
    __exports__["default"] = User;
  });
define("ghost/router", 
  ["ghost/utils/ghost-paths","ghost/utils/document-title","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ghostPaths = __dependency1__["default"];

    var documentTitle = __dependency2__["default"];

    
    var Router = Ember.Router.extend({
        location: 'trailing-history', // use HTML5 History API instead of hash-tag based URLs
        rootURL: ghostPaths().adminRoot, // admin interface lives under sub-directory /ghost
    
        clearNotifications: Ember.on('didTransition', function () {
            this.notifications.closePassive();
            this.notifications.displayDelayed();
        })
    });
    
    documentTitle();
    
    Router.map(function () {
        this.route('setup');
        this.route('signin');
        this.route('signout');
        this.route('signup', {path: '/signup/:token'});
        this.route('forgotten');
        this.route('reset', {path: '/reset/:token'});
    
        this.resource('posts', {path: '/'}, function () {
            this.route('post', {path: ':post_id'});
        });
    
        this.resource('editor', function () {
            this.route('new', {path: ''});
            this.route('edit', {path: ':post_id'});
        });
    
        this.resource('settings', function () {
            this.route('general');
    
            this.resource('settings.users', {path: '/users'}, function () {
                this.route('user', {path: '/:slug'});
            });
    
            this.route('about');
            this.route('tags');
            this.route('labs');
            this.route('code-injection');
            this.route('navigation');
        });
    
        // Redirect debug to settings labs
        this.route('debug');
    
        // Redirect legacy content to posts
        this.route('content');
    
        this.route('error404', {path: '/*path'});
    });
    
    __exports__["default"] = Router;
  });
define("ghost/routes/application", 
  ["ghost/mixins/shortcuts-route","ghost/utils/ctrl-or-cmd","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    /* global key */
    var ShortcutsRoute = __dependency1__["default"];

    var ctrlOrCmd = __dependency2__["default"];

    
    var ApplicationRoute,
        shortcuts = {};
    
    shortcuts.esc = {action: 'closePopups', scope: 'all'};
    shortcuts.enter = {action: 'confirmModal', scope: 'modal'};
    shortcuts[ctrlOrCmd + '+s'] = {action: 'save', scope: 'all'};
    
    ApplicationRoute = Ember.Route.extend(SimpleAuth.ApplicationRouteMixin, ShortcutsRoute, {
        shortcuts: shortcuts,
    
        afterModel: function (model, transition) {
            if (this.get('session').isAuthenticated) {
                transition.send('loadServerNotifications');
            }
        },
    
        title: function (tokens) {
            return tokens.join(' - ') + ' - ' + this.get('config.blogTitle');
        },
    
        actions: {
            toggleGlobalMobileNav: function () {
                this.toggleProperty('controller.showGlobalMobileNav');
            },
    
            openSettingsMenu: function () {
                this.set('controller.showSettingsMenu', true);
            },
    
            closeSettingsMenu: function () {
                this.set('controller.showSettingsMenu', false);
            },
    
            toggleSettingsMenu: function () {
                this.toggleProperty('controller.showSettingsMenu');
            },
    
            closePopups: function () {
                this.get('dropdown').closeDropdowns();
                this.get('notifications').closeAll();
    
                // Close right outlet if open
                this.send('closeSettingsMenu');
    
                this.send('closeModal');
            },
    
            signedIn: function () {
                this.send('loadServerNotifications', true);
            },
    
            sessionAuthenticationFailed: function (error) {
                if (error.errors) {
                    this.notifications.showErrors(error.errors);
                } else {
                    // connection errors don't return proper status message, only req.body
                    this.notifications.showError('There was a problem on the server.');
                }
            },
    
            sessionAuthenticationSucceeded: function () {
                var appController = this.controllerFor('application'),
                    self = this;
    
                if (appController && appController.get('skipAuthSuccessHandler')) {
                    return;
                }
    
                this.store.find('user', 'me').then(function (user) {
                    self.send('signedIn', user);
                    var attemptedTransition = self.get('session').get('attemptedTransition');
                    if (attemptedTransition) {
                        attemptedTransition.retry();
                        self.get('session').set('attemptedTransition', null);
                    } else {
                        self.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
                    }
                });
            },
    
            sessionInvalidationFailed: function (error) {
                this.notifications.showError(error.message);
            },
    
            openModal: function (modalName, model, type) {
                this.get('dropdown').closeDropdowns();
                key.setScope('modal');
                modalName = 'modals/' + modalName;
                this.set('modalName', modalName);
    
                // We don't always require a modal to have a controller
                // so we're skipping asserting if one exists
                if (this.controllerFor(modalName, true)) {
                    this.controllerFor(modalName).set('model', model);
    
                    if (type) {
                        this.controllerFor(modalName).set('imageType', type);
                        this.controllerFor(modalName).set('src', model.get(type));
                    }
                }
    
                return this.render(modalName, {
                    into: 'application',
                    outlet: 'modal'
                });
            },
    
            confirmModal: function () {
                var modalName = this.get('modalName');
    
                this.send('closeModal');
    
                if (this.controllerFor(modalName, true)) {
                    this.controllerFor(modalName).send('confirmAccept');
                }
            },
    
            closeModal: function () {
                this.disconnectOutlet({
                    outlet: 'modal',
                    parentView: 'application'
                });
    
                key.setScope('default');
            },
    
            loadServerNotifications: function (isDelayed) {
                var self = this;
    
                if (this.session.isAuthenticated) {
                    this.store.findAll('notification').then(function (serverNotifications) {
                        serverNotifications.forEach(function (notification) {
                            self.notifications.handleNotification(notification, isDelayed);
                        });
                    });
                }
            },
    
            handleErrors: function (errors) {
                var self = this;
    
                this.notifications.clear();
                errors.forEach(function (errorObj) {
                    self.notifications.showError(errorObj.message || errorObj);
    
                    if (errorObj.hasOwnProperty('el')) {
                        errorObj.el.addClass('input-error');
                    }
                });
            },
    
            // noop default for unhandled save (used from shortcuts)
            save: Ember.K
        }
    });
    
    __exports__["default"] = ApplicationRoute;
  });
define("ghost/routes/authenticated", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var AuthenticatedRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin);
    
    __exports__["default"] = AuthenticatedRoute;
  });
define("ghost/routes/content", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ContentRoute = Ember.Route.extend({
        beforeModel: function () {
            this.transitionTo('posts');
        }
    });
    
    __exports__["default"] = ContentRoute;
  });
define("ghost/routes/debug", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var DebugRoute = Ember.Route.extend({
        beforeModel: function () {
            this.transitionTo('settings.labs');
        }
    });
    
    __exports__["default"] = DebugRoute;
  });
define("ghost/routes/editor/edit", 
  ["ghost/routes/authenticated","ghost/mixins/editor-base-route","ghost/utils/isNumber","ghost/utils/isFinite","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var base = __dependency2__["default"];

    var isNumber = __dependency3__["default"];

    var isFinite = __dependency4__["default"];

    
    var EditorEditRoute = AuthenticatedRoute.extend(base, {
        titleToken: 'Editor',
    
        model: function (params) {
            var self = this,
                post,
                postId,
                query;
    
            postId = Number(params.post_id);
    
            if (!isNumber(postId) || !isFinite(postId) || postId % 1 !== 0 || postId <= 0) {
                return this.transitionTo('error404', 'editor/' + params.post_id);
            }
    
            post = this.store.getById('post', postId);
            if (post) {
                return post;
            }
    
            query = {
                id: postId,
                status: 'all',
                staticPages: 'all'
            };
    
            return self.store.find('post', query).then(function (records) {
                var post = records.get('firstObject');
    
                if (post) {
                    return post;
                }
    
                return self.replaceWith('posts.index');
            });
        },
    
        afterModel: function (post) {
            var self = this;
    
            return self.store.find('user', 'me').then(function (user) {
                if (user.get('isAuthor') && !post.isAuthoredByUser(user)) {
                    return self.replaceWith('posts.index');
                }
            });
        },
    
        actions: {
             authorizationFailed: function () {
                this.send('openModal', 'signin');
            }
        }
    });
    
    __exports__["default"] = EditorEditRoute;
  });
define("ghost/routes/editor/index", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var EditorRoute = Ember.Route.extend({
        beforeModel: function () {
            this.transitionTo('editor.new');
        }
    });
    
    __exports__["default"] = EditorRoute;
  });
define("ghost/routes/editor/new", 
  ["ghost/routes/authenticated","ghost/mixins/editor-base-route","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var base = __dependency2__["default"];

    
    var EditorNewRoute = AuthenticatedRoute.extend(base, {
        titleToken: 'Editor',
    
        model: function () {
            var self = this;
            return this.get('session.user').then(function (user) {
                return self.store.createRecord('post', {
                    author: user
                });
            });
        },
    
        setupController: function (controller, model) {
            var psm = this.controllerFor('post-settings-menu');
    
            // make sure there are no titleObserver functions hanging around
            // from previous posts
            psm.removeObserver('titleScratch', psm, 'titleObserver');
    
            // Ensure that the PSM Image Uploader and Publish Date selector resets
            psm.send('resetUploader');
            psm.send('resetPubDate');
    
            this._super(controller, model);
        }
    });
    
    __exports__["default"] = EditorNewRoute;
  });
define("ghost/routes/error404", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var Error404Route = Ember.Route.extend({
        controllerName: 'error',
        templateName: 'error',
        titleToken: 'Error',
    
        model: function () {
            return {
                status: 404
            };
        }
    });
    
    __exports__["default"] = Error404Route;
  });
define("ghost/routes/forgotten", 
  ["ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var styleBody = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    
    var ForgottenRoute = Ember.Route.extend(styleBody, loadingIndicator, {
        titleToken: 'Forgotten Password',
    
        classNames: ['ghost-forgotten']
    });
    
    __exports__["default"] = ForgottenRoute;
  });
define("ghost/routes/mobile-index-route", 
  ["ghost/utils/mobile","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var mobileQuery = __dependency1__["default"];

    
    // Routes that extend MobileIndexRoute need to implement
    // desktopTransition, a function which is called when
    // the user resizes to desktop levels.
    var MobileIndexRoute = Ember.Route.extend({
        desktopTransition: Ember.K,
    
        activate: function attachDesktopTransition() {
            this._super();
            mobileQuery.addListener(this.desktopTransitionMQ);
        },
    
        deactivate: function removeDesktopTransition() {
            this._super();
            mobileQuery.removeListener(this.desktopTransitionMQ);
        },
    
        setDesktopTransitionMQ: function () {
            var self = this;
            this.set('desktopTransitionMQ', function desktopTransitionMQ() {
                if (!mobileQuery.matches) {
                    self.desktopTransition();
                }
            });
        }.on('init')
    });
    
    __exports__["default"] = MobileIndexRoute;
  });
define("ghost/routes/posts", 
  ["ghost/routes/authenticated","ghost/mixins/style-body","ghost/mixins/shortcuts-route","ghost/mixins/loading-indicator","ghost/mixins/pagination-route","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    var ShortcutsRoute = __dependency3__["default"];

    var loadingIndicator = __dependency4__["default"];

    var PaginationRouteMixin = __dependency5__["default"];

    
    var paginationSettings,
        PostsRoute;
    
    paginationSettings = {
        status: 'all',
        staticPages: 'all',
        page: 1
    };
    
    PostsRoute = AuthenticatedRoute.extend(ShortcutsRoute, styleBody, loadingIndicator, PaginationRouteMixin, {
        titleToken: 'Content',
    
        classNames: ['manage'],
    
        model: function () {
            var self = this;
    
            return this.store.find('user', 'me').then(function (user) {
                if (user.get('isAuthor')) {
                    paginationSettings.author = user.get('slug');
                }
    
                // using `.filter` allows the template to auto-update when new models are pulled in from the server.
                // we just need to 'return true' to allow all models by default.
                return self.store.filter('post', paginationSettings, function (post) {
                    if (user.get('isAuthor')) {
                        return post.isAuthoredByUser(user);
                    }
    
                    return true;
                });
            });
        },
    
        setupController: function (controller, model) {
            this._super(controller, model);
            this.setupPagination(paginationSettings);
        },
    
        stepThroughPosts: function (step) {
            var currentPost = this.get('controller.currentPost'),
                posts = this.get('controller.arrangedContent'),
                length = posts.get('length'),
                newPosition;
    
            newPosition = posts.indexOf(currentPost) + step;
    
            // if we are on the first or last item
            // just do nothing (desired behavior is to not
            // loop around)
            if (newPosition >= length) {
                return;
            } else if (newPosition < 0) {
                return;
            }
    
            this.transitionTo('posts.post', posts.objectAt(newPosition));
        },
    
        scrollContent: function (amount) {
            var content = Ember.$('.js-content-preview'),
                scrolled = content.scrollTop();
    
            content.scrollTop(scrolled + 50 * amount);
        },
    
        shortcuts: {
            'up, k': 'moveUp',
            'down, j': 'moveDown',
            left: 'focusList',
            right: 'focusContent',
            c: 'newPost'
        },
    
        actions: {
            focusList: function () {
                this.controller.set('keyboardFocus', 'postList');
            },
            focusContent: function () {
                this.controller.set('keyboardFocus', 'postContent');
            },
            newPost: function () {
                this.transitionTo('editor.new');
            },
    
            moveUp: function () {
                if (this.controller.get('postContentFocused')) {
                    this.scrollContent(-1);
                } else {
                    this.stepThroughPosts(-1);
                }
            },
    
            moveDown: function () {
                if (this.controller.get('postContentFocused')) {
                    this.scrollContent(1);
                } else {
                    this.stepThroughPosts(1);
                }
            }
        }
    });
    
    __exports__["default"] = PostsRoute;
  });
define("ghost/routes/posts/index", 
  ["ghost/routes/mobile-index-route","ghost/mixins/loading-indicator","ghost/utils/mobile","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var MobileIndexRoute = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    var mobileQuery = __dependency3__["default"];

    
    var PostsIndexRoute = MobileIndexRoute.extend(SimpleAuth.AuthenticatedRouteMixin, loadingIndicator, {
        noPosts: false,
    
        // Transition to a specific post if we're not on mobile
        beforeModel: function () {
            if (!mobileQuery.matches) {
                return this.goToPost();
            }
        },
    
        setupController: function (controller, model) {
            /*jshint unused:false*/
            controller.set('noPosts', this.get('noPosts'));
        },
    
        goToPost: function () {
            var self = this,
                // the store has been populated by PostsRoute
                posts = this.store.all('post'),
                post;
    
            return this.store.find('user', 'me').then(function (user) {
                post = posts.find(function (post) {
                    // Authors can only see posts they've written
                    if (user.get('isAuthor')) {
                        return post.isAuthoredByUser(user);
                    }
    
                    return true;
                });
    
                if (post) {
                    return self.transitionTo('posts.post', post);
                }
    
                self.set('noPosts', true);
            });
        },
    
        // Mobile posts route callback
        desktopTransition: function () {
            this.goToPost();
        }
    });
    
    __exports__["default"] = PostsIndexRoute;
  });
define("ghost/routes/posts/post", 
  ["ghost/routes/authenticated","ghost/mixins/loading-indicator","ghost/mixins/shortcuts-route","ghost/utils/isNumber","ghost/utils/isFinite","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    var ShortcutsRoute = __dependency3__["default"];

    var isNumber = __dependency4__["default"];

    var isFinite = __dependency5__["default"];

    
    var PostsPostRoute = AuthenticatedRoute.extend(loadingIndicator, ShortcutsRoute, {
        model: function (params) {
            var self = this,
                post,
                postId,
                query;
    
            postId = Number(params.post_id);
    
            if (!isNumber(postId) || !isFinite(postId) || postId % 1 !== 0 || postId <= 0) {
                return this.transitionTo('error404', params.post_id);
            }
    
            post = this.store.getById('post', postId);
            if (post) {
                return post;
            }
    
            query = {
                id: postId,
                status: 'all',
                staticPages: 'all'
            };
    
            return self.store.find('post', query).then(function (records) {
                var post = records.get('firstObject');
    
                if (post) {
                    return post;
                }
    
                return self.replaceWith('posts.index');
            });
        },
    
        afterModel: function (post) {
            var self = this;
    
            return self.store.find('user', 'me').then(function (user) {
                if (user.get('isAuthor') && !post.isAuthoredByUser(user)) {
                    return self.replaceWith('posts.index');
                }
            });
        },
    
        setupController: function (controller, model) {
            this._super(controller, model);
    
            this.controllerFor('posts').set('currentPost', model);
        },
    
        shortcuts: {
            'enter, o': 'openEditor',
            'command+backspace, ctrl+backspace': 'deletePost'
        },
    
        actions: {
            openEditor: function () {
                this.transitionTo('editor.edit', this.get('controller.model'));
            },
    
            deletePost: function () {
                this.send('openModal', 'delete-post', this.get('controller.model'));
            }
        }
    });
    
    __exports__["default"] = PostsPostRoute;
  });
define("ghost/routes/reset", 
  ["ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var styleBody = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    
    var ResetRoute = Ember.Route.extend(styleBody, loadingIndicator, {
        classNames: ['ghost-reset'],
    
        beforeModel: function () {
            if (this.get('session').isAuthenticated) {
                this.notifications.showWarn('You can\'t reset your password while you\'re signed in.', {delayed: true});
                this.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
            }
        },
    
        setupController: function (controller, params) {
            controller.token = params.token;
        },
    
        // Clear out any sensitive information
        deactivate: function () {
            this._super();
            this.controller.clearData();
        }
    });
    
    __exports__["default"] = ResetRoute;
  });
define("ghost/routes/settings", 
  ["ghost/routes/authenticated","ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    var loadingIndicator = __dependency3__["default"];

    
    var SettingsRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, {
        titleToken: 'Settings',
    
        classNames: ['settings']
    });
    
    __exports__["default"] = SettingsRoute;
  });
define("ghost/routes/settings/about", 
  ["ghost/routes/authenticated","ghost/mixins/loading-indicator","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    var styleBody = __dependency3__["default"];

    
    var SettingsAboutRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, {
        titleToken: 'About',
    
        classNames: ['settings-view-about'],
    
        cachedConfig: false,
        model: function () {
            var cachedConfig = this.get('cachedConfig'),
                self = this;
            if (cachedConfig) {
                return cachedConfig;
            }
    
            return ic.ajax.request(this.get('ghostPaths.url').api('configuration'))
                .then(function (configurationResponse) {
                    var configKeyValues = configurationResponse.configuration;
                    cachedConfig = {};
                    configKeyValues.forEach(function (configKeyValue) {
                        cachedConfig[configKeyValue.key] = configKeyValue.value;
                    });
                    self.set('cachedConfig', cachedConfig);
                    return cachedConfig;
                });
        }
    });
    
    __exports__["default"] = SettingsAboutRoute;
  });
define("ghost/routes/settings/apps", 
  ["ghost/routes/authenticated","ghost/mixins/current-user-settings","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var CurrentUserSettings = __dependency2__["default"];

    var styleBody = __dependency3__["default"];

    
    var AppsRoute = AuthenticatedRoute.extend(styleBody, CurrentUserSettings, {
        titleToken: 'Apps',
    
        classNames: ['settings-view-apps'],
    
        beforeModel: function () {
            if (!this.get('config.apps')) {
                return this.transitionTo('settings.general');
            }
    
            return this.currentUser()
                .then(this.transitionAuthor())
                .then(this.transitionEditor());
        },
    
        model: function () {
            return this.store.find('app');
        }
    });
    
    __exports__["default"] = AppsRoute;
  });
define("ghost/routes/settings/code-injection", 
  ["ghost/routes/authenticated","ghost/mixins/loading-indicator","ghost/mixins/current-user-settings","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    var CurrentUserSettings = __dependency3__["default"];

    var styleBody = __dependency4__["default"];

    
    var SettingsCodeInjectionRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, CurrentUserSettings, {
        classNames: ['settings-view-code'],
    
        beforeModel: function () {
            var feature = this.controllerFor('feature'),
                self = this;
    
            if (!feature) {
                this.generateController('feature');
                feature = this.controllerFor('feature');
            }
    
            return this.currentUser()
                .then(this.transitionAuthor())
                .then(this.transitionEditor())
                .then(function () {
                    return feature.then(function () {
                        if (!feature.get('codeInjectionUI')) {
                            return self.transitionTo('settings.general');
                        }
                    });
                });
        },
    
        model: function () {
            return this.store.find('setting', {type: 'blog,theme'}).then(function (records) {
                return records.get('firstObject');
            });
        },
    
        actions: {
            save: function () {
                this.get('controller').send('save');
            }
        }
    });
    
    __exports__["default"] = SettingsCodeInjectionRoute;
  });
define("ghost/routes/settings/general", 
  ["ghost/routes/authenticated","ghost/mixins/loading-indicator","ghost/mixins/current-user-settings","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    var CurrentUserSettings = __dependency3__["default"];

    var styleBody = __dependency4__["default"];

    
    var SettingsGeneralRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, CurrentUserSettings, {
        titleToken: 'General',
    
        classNames: ['settings-view-general'],
    
        beforeModel: function () {
            return this.currentUser()
                .then(this.transitionAuthor())
                .then(this.transitionEditor());
        },
    
        model: function () {
            return this.store.find('setting', {type: 'blog,theme'}).then(function (records) {
                return records.get('firstObject');
            });
        },
    
        actions: {
            save: function () {
                this.get('controller').send('save');
            }
        }
    });
    
    __exports__["default"] = SettingsGeneralRoute;
  });
define("ghost/routes/settings/index", 
  ["ghost/routes/mobile-index-route","ghost/mixins/current-user-settings","ghost/utils/mobile","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var MobileIndexRoute = __dependency1__["default"];

    var CurrentUserSettings = __dependency2__["default"];

    var mobileQuery = __dependency3__["default"];

    
    var SettingsIndexRoute = MobileIndexRoute.extend(SimpleAuth.AuthenticatedRouteMixin, CurrentUserSettings, {
        titleToken: 'Settings',
    
        // Redirect users without permission to view settings,
        // and show the settings.general route unless the user
        // is mobile
        beforeModel: function () {
            var self = this;
            return this.currentUser()
                .then(this.transitionAuthor())
                .then(this.transitionEditor())
                .then(function () {
                    if (!mobileQuery.matches) {
                        self.transitionTo('settings.general');
                    }
                });
        },
    
        desktopTransition: function () {
            this.transitionTo('settings.general');
        }
    });
    
    __exports__["default"] = SettingsIndexRoute;
  });
define("ghost/routes/settings/labs", 
  ["ghost/routes/authenticated","ghost/mixins/style-body","ghost/mixins/current-user-settings","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    var CurrentUserSettings = __dependency3__["default"];

    var loadingIndicator = __dependency4__["default"];

    
    var LabsRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, CurrentUserSettings, {
        titleToken: 'Labs',
    
        classNames: ['settings'],
        beforeModel: function () {
            return this.currentUser()
                .then(this.transitionAuthor())
                .then(this.transitionEditor());
        },
    
        model: function () {
            return this.store.find('setting', {type: 'blog,theme'}).then(function (records) {
                return records.get('firstObject');
            });
        }
    });
    
    __exports__["default"] = LabsRoute;
  });
define("ghost/routes/settings/navigation", 
  ["ghost/routes/authenticated","ghost/mixins/current-user-settings","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var CurrentUserSettings = __dependency2__["default"];

    var styleBody = __dependency3__["default"];

    
    var NavigationRoute = AuthenticatedRoute.extend(styleBody, CurrentUserSettings, {
    
        titleToken: 'Navigation',
    
        classNames: ['settings-view-navigation'],
    
        beforeModel: function () {
            if (!this.get('config.navigationUI')) {
                return this.transitionTo('settings.general');
            }
    
            return this.currentUser().then(this.transitionAuthor());
        },
    
        model: function () {
            return this.store.find('setting', {type: 'blog,theme'}).then(function (records) {
                return records.get('firstObject');
            });
        },
    
        actions: {
            save: function () {
                // since shortcuts are run on the route, we have to signal to the components
                // on the page that we're about to save.
                $('.page-actions .btn-blue').focus();
    
                this.get('controller').send('save');
            }
        }
    });
    
    __exports__["default"] = NavigationRoute;
  });
define("ghost/routes/settings/tags", 
  ["ghost/routes/authenticated","ghost/mixins/current-user-settings","ghost/mixins/pagination-route","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var CurrentUserSettings = __dependency2__["default"];

    var PaginationRouteMixin = __dependency3__["default"];

    
    var TagsRoute,
        paginationSettings;
    
    paginationSettings = {
        page: 1,
        include: 'post_count',
        limit: 15
    };
    
    TagsRoute = AuthenticatedRoute.extend(CurrentUserSettings, PaginationRouteMixin, {
        actions: {
            willTransition: function () {
                this.send('closeSettingsMenu');
            }
        },
    
        titleToken: 'Tags',
    
        beforeModel: function () {
            return this.currentUser()
                .then(this.transitionAuthor());
        },
    
        model: function () {
            this.store.unloadAll('tag');
    
            return this.store.filter('tag', paginationSettings, function (tag) {
                return !tag.get('isNew');
            });
        },
    
        setupController: function (controller, model) {
            this._super(controller, model);
            this.setupPagination(paginationSettings);
        },
    
        renderTemplate: function (controller, model) {
            this._super(controller, model);
            this.render('settings/tags/settings-menu', {
                into: 'application',
                outlet: 'settings-menu',
                view: 'settings/tags/settings-menu'
            });
        },
    
        deactivate: function () {
            this.controller.send('resetPagination');
        }
    });
    
    __exports__["default"] = TagsRoute;
  });
define("ghost/routes/settings/users", 
  ["ghost/routes/authenticated","ghost/mixins/current-user-settings","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var CurrentUserSettings = __dependency2__["default"];

    
    var UsersRoute = AuthenticatedRoute.extend(CurrentUserSettings, {
        beforeModel: function () {
            return this.currentUser()
                .then(this.transitionAuthor());
        }
    });
    
    __exports__["default"] = UsersRoute;
  });
define("ghost/routes/settings/users/index", 
  ["ghost/routes/authenticated","ghost/mixins/pagination-route","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var PaginationRouteMixin = __dependency2__["default"];

    var styleBody = __dependency3__["default"];

    
    var paginationSettings,
        UsersIndexRoute;
    
    paginationSettings = {
        page: 1,
        limit: 20,
        status: 'active'
    };
    
    UsersIndexRoute = AuthenticatedRoute.extend(styleBody, PaginationRouteMixin, {
        titleToken: 'Users',
    
        classNames: ['settings-view-users'],
    
        setupController: function (controller, model) {
            this._super(controller, model);
            this.setupPagination(paginationSettings);
        },
    
        model: function () {
            var self = this;
    
            return self.store.find('user', {limit: 'all', status: 'invited'}).then(function () {
                return self.store.find('user', 'me').then(function (currentUser) {
                    if (currentUser.get('isEditor')) {
                        // Editors only see authors in the list
                        paginationSettings.role = 'Author';
                    }
    
                    return self.store.filter('user', paginationSettings, function (user) {
                        if (currentUser.get('isEditor')) {
                            return user.get('isAuthor') || user === currentUser;
                        }
                        return true;
                    });
                });
            });
        },
    
        actions: {
            reload: function () {
                this.refresh();
            }
        }
    });
    
    __exports__["default"] = UsersIndexRoute;
  });
define("ghost/routes/settings/users/user", 
  ["ghost/routes/authenticated","ghost/mixins/style-body","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    
    var SettingsUserRoute = AuthenticatedRoute.extend(styleBody, {
        titleToken: 'User',
    
        classNames: ['settings-view-user'],
    
        model: function (params) {
            var self = this;
            // TODO: Make custom user adapter that uses /api/users/:slug endpoint
            // return this.store.find('user', { slug: params.slug });
    
            // Instead, get all the users and then find by slug
            return this.store.find('user').then(function (result) {
                var user = result.findBy('slug', params.slug);
    
                if (!user) {
                    return self.transitionTo('error404', 'settings/users/' + params.slug);
                }
    
                return user;
            });
        },
    
        afterModel: function (user) {
            var self = this;
            this.store.find('user', 'me').then(function (currentUser) {
                var isOwnProfile = user.get('id') === currentUser.get('id'),
                    isAuthor = currentUser.get('isAuthor'),
                    isEditor = currentUser.get('isEditor');
                if (isAuthor && !isOwnProfile) {
                    self.transitionTo('settings.users.user', currentUser);
                } else if (isEditor && !isOwnProfile && !user.get('isAuthor')) {
                    self.transitionTo('settings.users');
                }
            });
        },
    
        deactivate: function () {
            var model = this.modelFor('settings.users.user');
    
            // we want to revert any unsaved changes on exit
            if (model && model.get('isDirty')) {
                model.rollback();
            }
    
            this._super();
        },
    
        actions: {
            save: function () {
                this.get('controller').send('save');
            }
        }
    });
    
    __exports__["default"] = SettingsUserRoute;
  });
define("ghost/routes/setup", 
  ["ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var styleBody = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    
    var SetupRoute = Ember.Route.extend(styleBody, loadingIndicator, {
        titleToken: 'Setup',
    
        classNames: ['ghost-setup'],
    
        // use the beforeModel hook to check to see whether or not setup has been
        // previously completed.  If it has, stop the transition into the setup page.
    
        beforeModel: function () {
            var self = this;
    
            // If user is logged in, setup has already been completed.
            if (this.get('session').isAuthenticated) {
                this.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
                return;
            }
    
            // If user is not logged in, check the state of the setup process via the API
            return ic.ajax.request(this.get('ghostPaths.url').api('authentication/setup'), {
                type: 'GET'
            }).then(function (result) {
                var setup = result.setup[0].status;
    
                if (setup) {
                    return self.transitionTo('signin');
                }
            });
        }
    });
    
    __exports__["default"] = SetupRoute;
  });
define("ghost/routes/signin", 
  ["ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var styleBody = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    
    var SigninRoute = Ember.Route.extend(styleBody, loadingIndicator, {
        titleToken: 'Sign In',
    
        classNames: ['ghost-login'],
    
        beforeModel: function () {
            if (this.get('session').isAuthenticated) {
                this.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
            }
        },
    
        model: function () {
            return Ember.Object.create({
                identification: '',
                password: ''
            });
        },
    
        // the deactivate hook is called after a route has been exited.
        deactivate: function () {
            this._super();
    
            var controller = this.controllerFor('signin');
    
            // clear the properties that hold the credentials when we're no longer on the signin screen
            controller.set('model.identification', '');
            controller.set('model.password', '');
        }
    });
    
    __exports__["default"] = SigninRoute;
  });
define("ghost/routes/signout", 
  ["ghost/routes/authenticated","ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var AuthenticatedRoute = __dependency1__["default"];

    var styleBody = __dependency2__["default"];

    var loadingIndicator = __dependency3__["default"];

    
    var SignoutRoute = AuthenticatedRoute.extend(styleBody, loadingIndicator, {
        titleToken: 'Sign Out',
    
        classNames: ['ghost-signout'],
    
        afterModel: function (model, transition) {
            this.notifications.clear();
            if (Ember.canInvoke(transition, 'send')) {
                transition.send('invalidateSession');
                transition.abort();
            } else {
                this.send('invalidateSession');
            }
        }
    });
    
    __exports__["default"] = SignoutRoute;
  });
define("ghost/routes/signup", 
  ["ghost/mixins/style-body","ghost/mixins/loading-indicator","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var styleBody = __dependency1__["default"];

    var loadingIndicator = __dependency2__["default"];

    
    var SignupRoute = Ember.Route.extend(styleBody, loadingIndicator, {
        classNames: ['ghost-signup'],
        beforeModel: function () {
            if (this.get('session').isAuthenticated) {
                this.notifications.showWarn('You need to sign out to register as a new user.', {delayed: true});
                this.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
            }
        },
    
        model: function (params) {
            var self = this,
                tokenText,
                email,
                model = Ember.Object.create(),
                re = /^(?:[A-Za-z0-9_\-]{4})*(?:[A-Za-z0-9_\-]{2}|[A-Za-z0-9_\-]{3})?$/;
    
            return new Ember.RSVP.Promise(function (resolve) {
                if (!re.test(params.token)) {
                    self.notifications.showError('Invalid token.', {delayed: true});
    
                    return resolve(self.transitionTo('signin'));
                }
    
                tokenText = atob(params.token);
                email = tokenText.split('|')[1];
    
                model.set('email', email);
                model.set('token', params.token);
    
                return ic.ajax.request({
                    url: self.get('ghostPaths.url').api('authentication', 'invitation'),
                    type: 'GET',
                    dataType: 'json',
                    data: {
                        email: email
                    }
                }).then(function (response) {
                    if (response && response.invitation && response.invitation[0].valid === false) {
                        self.notifications.showError('The invitation does not exist or is no longer valid.', {delayed: true});
    
                        return resolve(self.transitionTo('signin'));
                    }
    
                    resolve(model);
                }).catch(function () {
                    resolve(model);
                });
            });
        },
    
        deactivate: function () {
            this._super();
    
            // clear the properties that hold the sensitive data from the controller
            this.controllerFor('signup').setProperties({email: '', password: '', token: ''});
        }
    });
    
    __exports__["default"] = SignupRoute;
  });
define("ghost/serializers/application", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ApplicationSerializer = DS.RESTSerializer.extend({
        serializeIntoHash: function (hash, type, record, options) {
            // Our API expects an id on the posted object
            options = options || {};
            options.includeId = true;
    
            // We have a plural root in the API
            var root = Ember.String.pluralize(type.typeKey),
                data = this.serialize(record, options);
    
            // Don't ever pass uuid's
            delete data.uuid;
    
            hash[root] = [data];
        }
    });
    
    __exports__["default"] = ApplicationSerializer;
  });
define("ghost/serializers/post", 
  ["ghost/serializers/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationSerializer = __dependency1__["default"];

    
    var PostSerializer = ApplicationSerializer.extend(DS.EmbeddedRecordsMixin, {
        // settings for the EmbeddedRecordsMixin.
        attrs: {
            tags: {embedded: 'always'}
        },
    
        normalize: function (type, hash) {
            // this is to enable us to still access the raw author_id
            // without requiring an extra get request (since it is an
            // async relationship).
            hash.author_id = hash.author;
    
            return this._super(type, hash);
        },
    
        extractSingle: function (store, primaryType, payload) {
            var root = this.keyForAttribute(primaryType.typeKey),
                pluralizedRoot = Ember.String.pluralize(primaryType.typeKey);
    
            // make payload { post: { title: '', tags: [obj, obj], etc. } }.
            // this allows ember-data to pull the embedded tags out again,
            // in the function `updatePayloadWithEmbeddedHasMany` of the
            // EmbeddedRecordsMixin (line: `if (!partial[attribute])`):
            // https://github.com/emberjs/data/blob/master/packages/activemodel-adapter/lib/system/embedded_records_mixin.js#L499
            payload[root] = payload[pluralizedRoot][0];
            delete payload[pluralizedRoot];
    
            return this._super.apply(this, arguments);
        },
    
        serializeIntoHash: function (hash, type, record, options) {
            options = options || {};
            options.includeId = true;
    
            // We have a plural root in the API
            var root = Ember.String.pluralize(type.typeKey),
                data = this.serialize(record, options);
    
            // Properties that exist on the model but we don't want sent in the payload
    
            delete data.uuid;
            delete data.html;
            // Inserted locally as a convenience.
            delete data.author_id;
            // Read-only virtual property.
            delete data.url;
    
            hash[root] = [data];
        }
    });
    
    __exports__["default"] = PostSerializer;
  });
define("ghost/serializers/setting", 
  ["ghost/serializers/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationSerializer = __dependency1__["default"];

    
    var SettingSerializer = ApplicationSerializer.extend({
        serializeIntoHash: function (hash, type, record, options) {
            // Settings API does not want ids
            options = options || {};
            options.includeId = false;
    
            var root = Ember.String.pluralize(type.typeKey),
                data = this.serialize(record, options),
                payload = [];
    
            delete data.id;
    
            Object.keys(data).forEach(function (k) {
                payload.push({key: k, value: data[k]});
            });
    
            hash[root] = payload;
        },
    
        extractArray: function (store, type, _payload) {
            var payload = {id: '0'};
    
            _payload.settings.forEach(function (setting) {
                payload[setting.key] = setting.value;
            });
    
            return [payload];
        },
    
        extractSingle: function (store, type, payload) {
            return this.extractArray(store, type, payload).pop();
        }
    });
    
    __exports__["default"] = SettingSerializer;
  });
define("ghost/serializers/tag", 
  ["ghost/serializers/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationSerializer = __dependency1__["default"];

    
    var TagSerializer = ApplicationSerializer.extend({
        serializeIntoHash: function (hash, type, record, options) {
            options = options || {};
            options.includeId = true;
    
            var root = Ember.String.pluralize(type.typeKey),
                data = this.serialize(record, options);
    
            // Properties that exist on the model but we don't want sent in the payload
    
            delete data.uuid;
            delete data.post_count;
    
            hash[root] = [data];
        }
    });
    
    __exports__["default"] = TagSerializer;
  });
define("ghost/serializers/user", 
  ["ghost/serializers/application","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ApplicationSerializer = __dependency1__["default"];

    
    var UserSerializer = ApplicationSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
            roles: {embedded: 'always'}
        },
    
        extractSingle: function (store, primaryType, payload) {
            var root = this.keyForAttribute(primaryType.typeKey),
                pluralizedRoot = Ember.String.pluralize(primaryType.typeKey);
    
            payload[root] = payload[pluralizedRoot][0];
            delete payload[pluralizedRoot];
    
            return this._super.apply(this, arguments);
        }
    });
    
    __exports__["default"] = UserSerializer;
  });
define("ghost/transforms/moment-date", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /* global moment */
    var MomentDate = DS.Transform.extend({
        deserialize: function (serialized) {
            if (serialized) {
                return moment(serialized);
            }
            return serialized;
        },
        serialize: function (deserialized) {
            if (deserialized) {
                return moment(deserialized).toDate();
            }
            return deserialized;
        }
    });
    __exports__["default"] = MomentDate;
  });
define("ghost/utils/ajax", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /* global ic */
    
    var ajax = function () {
        return ic.ajax.request.apply(null, arguments);
    };
    
    // Used in API request fail handlers to parse a standard api error
    // response json for the message to display
    function getRequestErrorMessage(request, performConcat) {
        var message,
            msgDetail;
    
        // Can't really continue without a request
        if (!request) {
            return null;
        }
    
        // Seems like a sensible default
        message = request.statusText;
    
        // If a non 200 response
        if (request.status !== 200) {
            try {
                // Try to parse out the error, or default to 'Unknown'
                if (request.responseJSON.errors && Ember.isArray(request.responseJSON.errors)) {
                    message = request.responseJSON.errors.map(function (errorItem) {
                        return errorItem.message;
                    });
                } else {
                    message =  request.responseJSON.error || 'Unknown Error';
                }
            } catch (e) {
                msgDetail = request.status ? request.status + ' - ' + request.statusText : 'Server was not available';
                message = 'The server returned an error (' + msgDetail + ').';
            }
        }
    
        if (performConcat && Ember.isArray(message)) {
            message = message.join('<br />');
        }
    
        // return an array of errors by default
        if (!performConcat && typeof message === 'string') {
            message = [message];
        }
    
        return message;
    }
    
    __exports__.getRequestErrorMessage = getRequestErrorMessage;
    __exports__.ajax = ajax;

    __exports__["default"] = ajax;
  });
define("ghost/utils/bind", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var slice = Array.prototype.slice;
    
    function bind(/* func, args, thisArg */) {
        var args = slice.call(arguments),
            func = args.shift(),
            thisArg = args.pop();
    
        function bound() {
            return func.apply(thisArg, args);
        }
    
        return bound;
    }
    
    __exports__["default"] = bind;
  });
define("ghost/utils/bound-one-way", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
     * Defines a property similarly to `Ember.computed.oneway`,
     * save that while a `oneway` loses its binding upon being set,
     * the `BoundOneWay` will continue to listen for upstream changes.
     *
     * This is an ideal tool for working with values inside of {{input}}
     * elements.
     * @param {*} upstream
     * @param {function} transform a function to transform the **upstream** value.
     */
    var BoundOneWay = function (upstream, transform) {
        if (typeof transform !== 'function') {
            // default to the identity function
            transform = function (value) { return value; };
        }
    
        return Ember.computed(upstream, function (key, value) {
            return arguments.length > 1 ? value : transform(this.get(upstream));
        });
    };
    
    __exports__["default"] = BoundOneWay;
  });
define("ghost/utils/caja-sanitizers", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
     * google-caja uses url() and id() to verify if the values are allowed.
     */
    var url,
        id;
    
    /**
     * Check if URL is allowed
     * URLs are allowed if they start with http://, https://, or /.
     */
    url = function (url) {
        url = url.toString().replace(/['"]+/g, '');
        if (/^https?:\/\//.test(url) || /^\//.test(url)) {
            return url;
        }
    };
    
    /**
     * Check if ID is allowed
     * All ids are allowed at the moment.
     */
    id = function (id) {
        return id;
    };
    
    __exports__["default"] = {
        url: url,
        id: id
    };
  });
define("ghost/utils/codemirror-mobile", 
  ["ghost/assets/lib/touch-editor","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /*global CodeMirror, device, FastClick*/
    var createTouchEditor = __dependency1__["default"];

    
    var setupMobileCodeMirror,
        TouchEditor,
        init;
    
    setupMobileCodeMirror = function setupMobileCodeMirror() {
        var noop = function () {},
            key;
    
        for (key in CodeMirror) {
            if (CodeMirror.hasOwnProperty(key)) {
                CodeMirror[key] = noop;
            }
        }
    
        CodeMirror.fromTextArea = function (el, options) {
            return new TouchEditor(el, options);
        };
    
        CodeMirror.keyMap = {basic: {}};
    };
    
    init = function init() {
        // Codemirror does not function on mobile devices, or on any iDevice
        if (device.mobile() || (device.tablet() && device.ios())) {
            $('body').addClass('touch-editor');
    
            Ember.touchEditor = true;
    
            // initialize FastClick to remove touch delays
            Ember.run.scheduleOnce('afterRender', null, function () {
                FastClick.attach(document.body);
            });
    
            TouchEditor = createTouchEditor();
            setupMobileCodeMirror();
        }
    };
    
    __exports__["default"] = {
        createIfMobile: init
    };
  });
define("ghost/utils/codemirror-shortcuts", 
  ["ghost/utils/titleize","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global CodeMirror, moment, Showdown */
    // jscs:disable disallowSpacesInsideParentheses
    
    /** Set up a shortcut function to be called via router actions.
     *  See editor-base-route
     */
    
    var titleize = __dependency1__["default"];

    
    function init() {
        // remove predefined `ctrl+h` shortcut
        delete CodeMirror.keyMap.emacsy['Ctrl-H'];
    
        // Used for simple, noncomputational replace-and-go! shortcuts.
        // See default case in shortcut function below.
        CodeMirror.prototype.simpleShortcutSyntax = {
            bold: '**$1**',
            italic: '*$1*',
            strike: '~~$1~~',
            code: '`$1`',
            link: '[$1](http://)',
            image: '![$1](http://)',
            blockquote: '> $1'
        };
    
        CodeMirror.prototype.shortcut = function (type) {
            var text = this.getSelection(),
                cursor = this.getCursor(),
                line = this.getLine(cursor.line),
                fromLineStart = {line: cursor.line, ch: 0},
                toLineEnd = {line: cursor.line, ch: line.length},
                md, letterCount, textIndex, position, converter,
                generatedHTML, match, currentHeaderLevel, hashPrefix,
                replacementLine;
    
            switch (type) {
            case 'cycleHeaderLevel':
                match = line.match(/^#+/);
    
                if (!match) {
                    currentHeaderLevel = 1;
                } else {
                    currentHeaderLevel = match[0].length;
                }
    
                if (currentHeaderLevel > 2) {
                    currentHeaderLevel = 1;
                }
    
                hashPrefix = new Array(currentHeaderLevel + 2).join('#');
    
                replacementLine = hashPrefix + ' ' + line.replace(/^#* /, '');
    
                this.replaceRange(replacementLine, fromLineStart, toLineEnd);
                this.setCursor(cursor.line, cursor.ch + replacementLine.length);
                break;
    
            case 'link':
                md = this.simpleShortcutSyntax.link.replace('$1', text);
                this.replaceSelection(md, 'end');
                if (!text) {
                    this.setCursor(cursor.line, cursor.ch + 1);
                } else {
                    textIndex = line.indexOf(text, cursor.ch - text.length);
                    position = textIndex + md.length - 1;
                    this.setSelection({
                        line: cursor.line,
                        ch: position - 7
                    }, {
                        line: cursor.line,
                        ch: position
                    });
                }
                return;
    
            case 'image':
                md = this.simpleShortcutSyntax.image.replace('$1', text);
                if (line !== '') {
                    md = '\n\n' + md;
                }
                this.replaceSelection(md, 'end');
                cursor = this.getCursor();
                this.setSelection({line: cursor.line, ch: cursor.ch - 8}, {line: cursor.line, ch: cursor.ch - 1});
                return;
    
            case 'list':
                md = text.replace(/^(\s*)(\w\W*)/gm, '$1* $2');
                this.replaceSelection(md, 'end');
                return;
    
            case 'currentDate':
                md = moment(new Date()).format('D MMMM YYYY');
                this.replaceSelection(md, 'end');
                return;
    
            case 'uppercase':
                md = text.toLocaleUpperCase();
                break;
    
            case 'lowercase':
                md = text.toLocaleLowerCase();
                break;
    
            case 'titlecase':
                md = titleize(text);
                break;
    
            case 'copyHTML':
                converter = new Showdown.converter();
    
                if (text) {
                    generatedHTML = converter.makeHtml(text);
                } else {
                    generatedHTML = converter.makeHtml(this.getValue());
                }
    
                // Talk to Ember
                this.component.sendAction('openModal', 'copy-html', {generatedHTML: generatedHTML});
    
                break;
    
            default:
                if (this.simpleShortcutSyntax[type]) {
                    md = this.simpleShortcutSyntax[type].replace('$1', text);
                }
            }
            if (md) {
                this.replaceSelection(md, 'end');
                if (!text) {
                    letterCount = md.length;
                    this.setCursor({
                        line: cursor.line,
                        ch: cursor.ch + (letterCount / 2)
                    });
                }
            }
        };
    }
    
    __exports__["default"] = {
        init: init
    };
  });
define("ghost/utils/config-parser", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var isNumeric = function (num) {
            return !isNaN(num);
        },
    
        _mapType = function (val) {
            if (val === '') {
                return null;
            } else if (val === 'true') {
                return true;
            } else if (val === 'false') {
                return false;
            } else if (isNumeric(val)) {
                return +val;
            } else {
                return val;
            }
        },
    
        parseConfiguration = function () {
            var metaConfigTags = $('meta[name^="env-"]'),
                propertyName,
                config = {},
                value,
                key,
                i;
    
            for (i = 0; i < metaConfigTags.length; i += 1) {
                key = $(metaConfigTags[i]).prop('name');
                value = $(metaConfigTags[i]).prop('content');
                propertyName = key.substring(4);        // produce config name ignoring the initial 'env-'.
                config[propertyName] = _mapType(value); // map string values to types if possible
            }
            return config;
        };
    
    __exports__["default"] = parseConfiguration;
  });
define("ghost/utils/ctrl-or-cmd", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ctrlOrCmd = navigator.userAgent.indexOf('Mac') !== -1 ? 'command' : 'ctrl';
    
    __exports__["default"] = ctrlOrCmd;
  });
define("ghost/utils/date-formatting", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /* global moment */
    // jscs: disable disallowSpacesInsideParentheses
    
    var parseDateFormats,
        displayDateFormat,
        verifyTimeStamp,
        parseDateString,
        formatDate;
    
    parseDateFormats = ['DD MMM YY @ HH:mm', 'DD MMM YY HH:mm',
                            'DD MMM YYYY @ HH:mm', 'DD MMM YYYY HH:mm',
                            'DD/MM/YY @ HH:mm', 'DD/MM/YY HH:mm',
                            'DD/MM/YYYY @ HH:mm', 'DD/MM/YYYY HH:mm',
                            'DD-MM-YY @ HH:mm', 'DD-MM-YY HH:mm',
                            'DD-MM-YYYY @ HH:mm', 'DD-MM-YYYY HH:mm',
                            'YYYY-MM-DD @ HH:mm', 'YYYY-MM-DD HH:mm',
                            'DD MMM @ HH:mm', 'DD MMM HH:mm'];
    
    displayDateFormat = 'DD MMM YY @ HH:mm';
    
    // Add missing timestamps
    verifyTimeStamp = function (dateString) {
        if (dateString && !dateString.slice(-5).match(/\d+:\d\d/)) {
            dateString += ' 12:00';
        }
        return dateString;
    };
    
    // Parses a string to a Moment
    parseDateString = function (value) {
        return value ? moment(verifyTimeStamp(value), parseDateFormats, true) : undefined;
    };
    
    // Formats a Date or Moment
    formatDate = function (value) {
        return verifyTimeStamp(value ? moment(value).format(displayDateFormat) : '');
    };
    
    __exports__.parseDateString = parseDateString;
    __exports__.formatDate = formatDate;
  });
define("ghost/utils/document-title", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var documentTitle = function () {
        Ember.Route.reopen({
            // `titleToken` can either be a static string or a function
            // that accepts a model object and returns a string (or array
            // of strings if there are multiple tokens).
            titleToken: null,
    
            // `title` can either be a static string or a function
            // that accepts an array of tokens and returns a string
            // that will be the document title. The `collectTitleTokens` action
            // stops bubbling once a route is encountered that has a `title`
            // defined.
            title: null,
    
            _actions: {
                collectTitleTokens: function (tokens) {
                    var titleToken = this.titleToken,
                        finalTitle;
    
                    if (typeof this.titleToken === 'function') {
                        titleToken = this.titleToken(this.currentModel);
                    }
    
                    if (Ember.isArray(titleToken)) {
                        tokens.unshift.apply(this, titleToken);
                    } else if (titleToken) {
                        tokens.unshift(titleToken);
                    }
    
                    if (this.title) {
                        if (typeof this.title === 'function') {
                            finalTitle = this.title(tokens);
                        } else {
                            finalTitle = this.title;
                        }
    
                        this.router.setTitle(finalTitle);
                    } else {
                        return true;
                    }
                }
            }
        });
    
        Ember.Router.reopen({
            updateTitle: function () {
                this.send('collectTitleTokens', []);
            }.on('didTransition'),
    
            setTitle: function (title) {
                if (Ember.testing) {
                    this._title = title;
                } else {
                    window.document.title = title;
                }
            }
        });
    };
    
    __exports__["default"] = documentTitle;
  });
define("ghost/utils/dropdown-service", 
  ["ghost/mixins/body-event-listener","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    // This is used by the dropdown initializer (and subsequently popovers) to manage closing & toggling
    var BodyEventListener = __dependency1__["default"];

    
    var DropdownService = Ember.Object.extend(Ember.Evented, BodyEventListener, {
        bodyClick: function (event) {
            /*jshint unused:false */
            this.closeDropdowns();
        },
        closeDropdowns: function () {
            this.trigger('close');
        },
        toggleDropdown: function (dropdownName, dropdownButton) {
            this.trigger('toggle', {target: dropdownName, button: dropdownButton});
        }
    });
    
    __exports__["default"] = DropdownService;
  });
define("ghost/utils/editor-shortcuts", 
  ["ghost/utils/ctrl-or-cmd","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ctrlOrCmd = __dependency1__["default"];

    
    var shortcuts = {};
    
    // General editor shortcuts
    shortcuts[ctrlOrCmd + '+alt+p'] = 'publish';
    shortcuts['alt+shift+z'] = 'toggleZenMode';
    
    // CodeMirror Markdown Shortcuts
    
    // Text
    shortcuts['ctrl+alt+u'] = {action: 'codeMirrorShortcut', options: {type: 'strike'}};
    shortcuts[ctrlOrCmd + '+b'] = {action: 'codeMirrorShortcut', options: {type: 'bold'}};
    shortcuts[ctrlOrCmd + '+i'] = {action: 'codeMirrorShortcut', options: {type: 'italic'}};
    
    shortcuts['ctrl+u'] = {action: 'codeMirrorShortcut', options: {type: 'uppercase'}};
    shortcuts['ctrl+shift+u'] = {action: 'codeMirrorShortcut', options: {type: 'lowercase'}};
    shortcuts['ctrl+alt+shift+u'] = {action: 'codeMirrorShortcut', options: {type: 'titlecase'}};
    shortcuts[ctrlOrCmd + '+shift+c'] = {action: 'codeMirrorShortcut', options: {type: 'copyHTML'}};
    shortcuts[ctrlOrCmd + '+h'] = {action: 'codeMirrorShortcut', options: {type: 'cycleHeaderLevel'}};
    
    // Formatting
    shortcuts['ctrl+q'] = {action: 'codeMirrorShortcut', options: {type: 'blockquote'}};
    shortcuts['ctrl+l'] = {action: 'codeMirrorShortcut', options: {type: 'list'}};
    
    // Insert content
    shortcuts['ctrl+shift+1'] = {action: 'codeMirrorShortcut', options: {type: 'currentDate'}};
    shortcuts[ctrlOrCmd + '+k'] = {action: 'codeMirrorShortcut', options: {type: 'link'}};
    shortcuts[ctrlOrCmd + '+shift+i'] = {action: 'codeMirrorShortcut', options: {type: 'image'}};
    shortcuts[ctrlOrCmd + '+shift+k'] = {action: 'codeMirrorShortcut', options: {type: 'code'}};
    
    __exports__["default"] = shortcuts;
  });
define("ghost/utils/ghost-paths", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var makeRoute = function (root, args) {
        var slashAtStart,
            slashAtEnd,
            parts,
            route;
    
        slashAtStart = /^\//;
        slashAtEnd = /\/$/;
        route = root.replace(slashAtEnd, '');
        parts = Array.prototype.slice.call(args, 0);
    
        parts.forEach(function (part) {
            route = [route, part.replace(slashAtStart, '').replace(slashAtEnd, '')].join('/');
        });
        return route += '/';
    };
    
    function ghostPaths() {
        var path = window.location.pathname,
            subdir = path.substr(0, path.search('/ghost/')),
            adminRoot = subdir + '/ghost',
            apiRoot = subdir + '/ghost/api/v0.1';
    
        function assetUrl(src) {
            return subdir + src;
        }
    
        return {
            subdir: subdir,
            blogRoot: subdir + '/',
            adminRoot: adminRoot,
            apiRoot: apiRoot,
    
            url: {
                admin: function () {
                    return makeRoute(adminRoot, arguments);
                },
    
                api: function () {
                    return makeRoute(apiRoot, arguments);
                },
    
                join: function () {
                    if (arguments.length > 1) {
                        return makeRoute(arguments[0], Array.prototype.slice.call(arguments, 1));
                    } else if (arguments.length === 1) {
                        var arg = arguments[0];
                        return arg.slice(-1) === '/' ? arg : arg + '/';
                    }
                    return '/';
                },
    
                asset: assetUrl
            }
        };
    }
    
    __exports__["default"] = ghostPaths;
  });
define("ghost/utils/isFinite", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /* globals window */
    
    // isFinite function from lodash
    
    function isFinite(value) {
        return window.isFinite(value) && !window.isNaN(parseFloat(value));
    }
    
    __exports__["default"] = isFinite;
  });
define("ghost/utils/isNumber", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // isNumber function from lodash
    
    var toString = Object.prototype.toString;
    
    function isNumber(value) {
        return typeof value === 'number' ||
          value && typeof value === 'object' && toString.call(value) === '[object Number]' || false;
    }
    
    __exports__["default"] = isNumber;
  });
define("ghost/utils/link-view", 
  [],
  function() {
    "use strict";
    Ember.LinkView.reopen({
        active: Ember.computed('loadedParams', 'resolvedParams', 'routeArgs', function () {
            var isActive = this._super();
    
            Ember.set(this, 'alternateActive', isActive);
    
            return isActive;
        }),
    
        activeClass: Ember.computed('tagName', function () {
            return this.get('tagName') === 'button' ? '' : 'active';
        })
    });
  });
define("ghost/utils/mobile", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var mobileQuery = matchMedia('(max-width: 900px)');
    
    __exports__["default"] = mobileQuery;
  });
define("ghost/utils/notifications", 
  ["ghost/models/notification","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var Notification = __dependency1__["default"];

    
    var Notifications = Ember.ArrayProxy.extend({
        delayedNotifications: [],
        content: Ember.A(),
        timeout: 3000,
    
        pushObject: function (object) {
            // object can be either a DS.Model or a plain JS object, so when working with
            // it, we need to handle both cases.
    
            // make sure notifications have all the necessary properties set.
            if (typeof object.toJSON === 'function') {
                // working with a DS.Model
    
                if (object.get('location') === '') {
                    object.set('location', 'bottom');
                }
            } else {
                if (!object.location) {
                    object.location = 'bottom';
                }
            }
    
            this._super(object);
        },
        handleNotification: function (message, delayed) {
            if (!message.status) {
                message.status = 'passive';
            }
    
            if (!delayed) {
                this.pushObject(message);
            } else {
                this.delayedNotifications.push(message);
            }
        },
        showError: function (message, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            this.handleNotification({
                type: 'error',
                message: message
            }, options.delayed);
        },
        showErrors: function (errors, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            for (var i = 0; i < errors.length; i += 1) {
                this.showError(errors[i].message || errors[i], {doNotClosePassive: true});
            }
        },
        showAPIError: function (resp, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            options.defaultErrorText = options.defaultErrorText || 'There was a problem on the server, please try again.';
    
            if (resp && resp.jqXHR && resp.jqXHR.responseJSON && resp.jqXHR.responseJSON.error) {
                this.showError(resp.jqXHR.responseJSON.error, options);
            } else if (resp && resp.jqXHR && resp.jqXHR.responseJSON && resp.jqXHR.responseJSON.errors) {
                this.showErrors(resp.jqXHR.responseJSON.errors, options);
            } else if (resp && resp.jqXHR && resp.jqXHR.responseJSON && resp.jqXHR.responseJSON.message) {
                this.showError(resp.jqXHR.responseJSON.message, options);
            } else {
                this.showError(options.defaultErrorText, {doNotClosePassive: true});
            }
        },
        showInfo: function (message, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            this.handleNotification({
                type: 'info',
                message: message
            }, options.delayed);
        },
        showSuccess: function (message, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            this.handleNotification({
                type: 'success',
                message: message
            }, options.delayed);
        },
        showWarn: function (message, options) {
            options = options || {};
    
            if (!options.doNotClosePassive) {
                this.closePassive();
            }
    
            this.handleNotification({
                type: 'warn',
                message: message
            }, options.delayed);
        },
        displayDelayed: function () {
            var self = this;
    
            self.delayedNotifications.forEach(function (message) {
                self.pushObject(message);
            });
            self.delayedNotifications = [];
        },
        closeNotification: function (notification) {
            var self = this;
    
            if (notification instanceof Notification) {
                notification.deleteRecord();
                notification.save().finally(function () {
                    self.removeObject(notification);
                });
            } else {
                this.removeObject(notification);
            }
        },
        closePassive: function () {
            this.set('content', this.rejectBy('status', 'passive'));
        },
        closePersistent: function () {
            this.set('content', this.rejectBy('status', 'persistent'));
        },
        closeAll: function () {
            this.clear();
        }
    });
    
    __exports__["default"] = Notifications;
  });
define("ghost/utils/set-scroll-classname", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // ## scrollShadow
    // This adds a 'scroll' class to the targeted element when the element is scrolled
    // `this` is expected to be a jQuery-wrapped element
    // **target:** The element in which the class is applied. Defaults to scrolled element.
    // **class-name:** The class which is applied.
    // **offset:** How far the user has to scroll before the class is applied.
    var setScrollClassName = function (options) {
        var $target = options.target || this,
            offset = options.offset,
            className = options.className || 'scrolling';
    
        if (this.scrollTop() > offset) {
            $target.addClass(className);
        } else {
            $target.removeClass(className);
        }
    };
    
    __exports__["default"] = setScrollClassName;
  });
define("ghost/utils/text-field", 
  [],
  function() {
    "use strict";
    Ember.TextField.reopen({
        attributeBindings: ['autofocus']
    });
  });
define("ghost/utils/titleize", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var lowerWords = ['of', 'a', 'the', 'and', 'an', 'or', 'nor', 'but', 'is', 'if',
                      'then', 'else', 'when', 'at', 'from', 'by', 'on', 'off', 'for',
                      'in', 'out', 'over', 'to', 'into', 'with'];
    
    function titleize(input) {
        var words = input.split(' ').map(function (word, index) {
            if (index === 0 || lowerWords.indexOf(word) === -1) {
                word = Ember.String.capitalize(word);
            }
    
            return word;
        });
    
        return words.join(' ');
    }
    
    __exports__["default"] = titleize;
  });
define("ghost/utils/validator-extensions", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function init() {
        // Provide a few custom validators
        //
        validator.extend('empty', function (str) {
            return Ember.isBlank(str);
        });
    
        validator.extend('notContains', function (str, badString) {
            return str.indexOf(badString) === -1;
        });
    }
    
    __exports__["default"] = {
        init: init
    };
  });
define("ghost/utils/word-count", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // jscs: disable
    function wordCount(s) {
        s = s.replace(/<(.|\n)*?>/g, ' '); // strip tags
        s = s.replace(/[^\w\s]/g, ''); // ignore non-alphanumeric letters
        s = s.replace(/(^\s*)|(\s*$)/gi, ''); // exclude starting and ending white-space
        s = s.replace(/\n /gi, ' '); // convert newlines to spaces
        s = s.replace(/\n+/gi, ' ');
        s = s.replace(/[ ]{2,}/gi, ' '); // convert 2 or more spaces to 1
    
        return s.split(' ').length;
    }
    
    __exports__["default"] = wordCount;
  });
define("ghost/validators/forgotten", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ForgotValidator = Ember.Object.create({
        check: function (model) {
            var data = model.getProperties('email'),
                validationErrors = [];
    
            if (!validator.isEmail(data.email)) {
                validationErrors.push({
                    message: 'Invalid email address'
                });
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = ForgotValidator;
  });
define("ghost/validators/new-user", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NewUserValidator = Ember.Object.extend({
        check: function (model) {
            var data = model.getProperties('name', 'email', 'password'),
                validationErrors = [];
    
            if (!validator.isLength(data.name, 1)) {
                validationErrors.push({
                    message: 'Please enter a name.'
                });
            }
    
            if (!validator.isEmail(data.email)) {
                validationErrors.push({
                    message: 'Invalid Email.'
                });
            }
    
            if (!validator.isLength(data.password, 8)) {
                validationErrors.push({
                    message: 'Password must be at least 8 characters long.'
                });
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = NewUserValidator;
  });
define("ghost/validators/post", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PostValidator = Ember.Object.create({
        check: function (model) {
            var validationErrors = [],
                data = model.getProperties('title', 'meta_title', 'meta_description');
    
            if (validator.empty(data.title)) {
                validationErrors.push({
                    message: 'You must specify a title for the post.'
                });
            }
    
            if (!validator.isLength(data.meta_title, 0, 150)) {
                validationErrors.push({
                    message: 'Meta Title cannot be longer than 150 characters.'
                });
            }
    
            if (!validator.isLength(data.meta_description, 0, 200)) {
                validationErrors.push({
                    message: 'Meta Description cannot be longer than 200 characters.'
                });
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = PostValidator;
  });
define("ghost/validators/reset", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ResetValidator = Ember.Object.create({
        check: function (model) {
            var p1 = model.get('newPassword'),
                p2 = model.get('ne2Password'),
                validationErrors = [];
    
            if (!validator.equals(p1, p2)) {
                validationErrors.push({
                    message: 'The two new passwords don\'t match.'
                });
            }
    
            if (!validator.isLength(p1, 8)) {
                validationErrors.push({
                    message: 'The password is not long enough.'
                });
            }
            return validationErrors;
        }
    });
    
    __exports__["default"] = ResetValidator;
  });
define("ghost/validators/setting", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingValidator = Ember.Object.create({
        check: function (model) {
            var validationErrors = [],
                title = model.get('title'),
                description = model.get('description'),
                email = model.get('email'),
                postsPerPage = model.get('postsPerPage');
    
            if (!validator.isLength(title, 0, 150)) {
                validationErrors.push({message: 'Title is too long'});
            }
    
            if (!validator.isLength(description, 0, 200)) {
                validationErrors.push({message: 'Description is too long'});
            }
    
            if (!validator.isEmail(email) || !validator.isLength(email, 0, 254)) {
                validationErrors.push({message: 'Supply a valid email address'});
            }
    
            if (postsPerPage > 1000) {
                validationErrors.push({message: 'The maximum number of posts per page is 1000'});
            }
    
            if (postsPerPage < 1) {
                validationErrors.push({message: 'The minimum number of posts per page is 1'});
            }
    
            if (!validator.isInt(postsPerPage)) {
                validationErrors.push({message: 'Posts per page must be a number'});
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = SettingValidator;
  });
define("ghost/validators/setup", 
  ["ghost/validators/new-user","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var NewUserValidator = __dependency1__["default"];

    
    var SetupValidator = NewUserValidator.extend({
        check: function (model) {
            var data = model.getProperties('blogTitle'),
                validationErrors = this._super(model);
    
            if (!validator.isLength(data.blogTitle, 1)) {
                validationErrors.push({
                    message: 'Please enter a blog title.'
                });
            }
    
            return validationErrors;
        }
    }).create();
    
    __exports__["default"] = SetupValidator;
  });
define("ghost/validators/signin", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SigninValidator = Ember.Object.create({
        check: function (model) {
            var data = model.getProperties('identification', 'password'),
                validationErrors = [];
    
            if (!validator.isEmail(data.identification)) {
                validationErrors.push('Invalid Email');
            }
    
            if (!validator.isLength(data.password || '', 1)) {
                validationErrors.push('Please enter a password');
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = SigninValidator;
  });
define("ghost/validators/signup", 
  ["ghost/validators/new-user","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var NewUserValidator = __dependency1__["default"];

    
    __exports__["default"] = NewUserValidator.create();
  });
define("ghost/validators/tag-settings", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var TagSettingsValidator = Ember.Object.create({
        check: function (model) {
            var validationErrors = [],
                data = model.getProperties('name', 'meta_title', 'meta_description');
    
            if (validator.empty(data.name)) {
                validationErrors.push({
                    message: 'You must specify a name for the tag.'
                });
            }
    
            if (!validator.isLength(data.meta_title, 0, 150)) {
                validationErrors.push({
                    message: 'Meta Title cannot be longer than 150 characters.'
                });
            }
    
            if (!validator.isLength(data.meta_description, 0, 200)) {
                validationErrors.push({
                    message: 'Meta Description cannot be longer than 200 characters.'
                });
            }
    
            return validationErrors;
        }
    });
    
    __exports__["default"] = TagSettingsValidator;
  });
define("ghost/validators/user", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var UserValidator = Ember.Object.create({
        check: function (model) {
            var validator = this.validators[model.get('status')];
    
            if (typeof validator !== 'function') {
                return [];
            }
    
            return validator(model);
        },
    
        validators: {
            invited: function (model) {
                var validationErrors = [],
                    email = model.get('email'),
                    roles = model.get('roles');
    
                if (!validator.isEmail(email)) {
                    validationErrors.push({message: 'Please supply a valid email address'});
                }
    
                if (roles.length < 1) {
                    validationErrors.push({message: 'Please select a role'});
                }
    
                return validationErrors;
            },
    
            active: function (model) {
                var validationErrors = [],
                    name = model.get('name'),
                    bio = model.get('bio'),
                    email = model.get('email'),
                    location = model.get('location'),
                    website = model.get('website');
    
                if (!validator.isLength(name, 0, 150)) {
                    validationErrors.push({message: 'Name is too long'});
                }
    
                if (!validator.isLength(bio, 0, 200)) {
                    validationErrors.push({message: 'Bio is too long'});
                }
    
                if (!validator.isEmail(email)) {
                    validationErrors.push({message: 'Please supply a valid email address'});
                }
    
                if (!validator.isLength(location, 0, 150)) {
                    validationErrors.push({message: 'Location is too long'});
                }
    
                if (!Ember.isEmpty(website) &&
                    (!validator.isURL(website, {require_protocol: false}) ||
                    !validator.isLength(website, 0, 2000))) {
                    validationErrors.push({message: 'Website is not a valid url'});
                }
    
                return validationErrors;
            }
        }
    });
    
    __exports__["default"] = UserValidator;
  });
define("ghost/views/application", 
  ["ghost/utils/mobile","ghost/utils/bind","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var mobileQuery = __dependency1__["default"];

    var bind = __dependency2__["default"];

    
    var ApplicationView = Ember.View.extend({
        elementId: 'container',
    
        setupGlobalMobileNav: function () {
            // #### Navigating within the sidebar closes it.
            var self = this;
            $('body').on('click tap', '.js-nav-item', function () {
                if (mobileQuery.matches) {
                    self.set('controller.showGlobalMobileNav', false);
                }
            });
    
            // #### Close the nav if mobile and clicking outside of the nav or not the burger toggle
            $('.js-nav-cover').on('click tap', function () {
                var isOpen = self.get('controller.showGlobalMobileNav');
                if (isOpen) {
                    self.set('controller.showGlobalMobileNav', false);
                }
            });
    
            // #### Listen to the viewport and change user-menu dropdown triangle classes accordingly
            mobileQuery.addListener(this.swapUserMenuDropdownTriangleClasses);
            this.swapUserMenuDropdownTriangleClasses(mobileQuery);
        }.on('didInsertElement'),
    
        swapUserMenuDropdownTriangleClasses: function (mq) {
            if (mq.matches) {
                $('.js-user-menu-dropdown-menu').removeClass('dropdown-triangle-top-right ').addClass('dropdown-triangle-bottom');
            } else {
                $('.js-user-menu-dropdown-menu').removeClass('dropdown-triangle-bottom').addClass('dropdown-triangle-top-right');
            }
        },
    
        showGlobalMobileNavObserver: function () {
            if (this.get('controller.showGlobalMobileNav')) {
                $('body').addClass('global-nav-expanded');
            } else {
                $('body').removeClass('global-nav-expanded');
            }
        }.observes('controller.showGlobalMobileNav'),
    
        setupCloseNavOnDesktop: function () {
            this.set('closeGlobalMobileNavOnDesktop', bind(function closeGlobalMobileNavOnDesktop(mq) {
                if (!mq.matches) {
                    // Is desktop sized
                    this.set('controller.showGlobalMobileNav', false);
                }
            }, this));
    
            mobileQuery.addListener(this.closeGlobalMobileNavOnDesktop);
        }.on('didInsertElement'),
    
        removeCloseNavOnDesktop: function () {
            mobileQuery.removeListener(this.closeGlobalMobileNavOnDesktop);
        }.on('willDestroyElement'),
    
        toggleSettingsMenuBodyClass: function () {
            $('body').toggleClass('settings-menu-expanded', this.get('controller.showSettingsMenu'));
        }.observes('controller.showSettingsMenu')
    });
    
    __exports__["default"] = ApplicationView;
  });
define("ghost/views/content-preview-content-view", 
  ["ghost/utils/set-scroll-classname","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var setScrollClassName = __dependency1__["default"];

    
    var PostContentView = Ember.View.extend({
        classNames: ['content-preview-content'],
    
        didInsertElement: function () {
            var el = this.$();
            el.on('scroll', Ember.run.bind(el, setScrollClassName, {
                target: el.closest('.content-preview'),
                offset: 10
            }));
        },
    
        contentObserver: function () {
            this.$().closest('.content-preview').scrollTop(0);
        }.observes('controller.content'),
    
        willDestroyElement: function () {
            var el = this.$();
            el.off('scroll');
        }
    });
    
    __exports__["default"] = PostContentView;
  });
define("ghost/views/editor-save-button", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var EditorSaveButtonView = Ember.View.extend({
        templateName: 'editor-save-button',
        tagName: 'section',
        classNames: ['splitbtn', 'js-publish-splitbutton'],
    
        // Tracks whether we're going to change the state of the post on save
        isDangerous: Ember.computed('controller.model.isPublished', 'controller.willPublish', function () {
            return this.get('controller.model.isPublished') !== this.get('controller.willPublish');
        }),
    
        publishText: Ember.computed('controller.model.isPublished', 'controller.pageOrPost', function () {
            return this.get('controller.model.isPublished') ? 'Update ' + this.get('controller.postOrPage') : 'Publish Now';
        }),
    
        draftText: Ember.computed('controller.model.isPublished', function () {
            return this.get('controller.model.isPublished') ? 'Unpublish' : 'Save Draft';
        }),
    
        deleteText: Ember.computed('controller.postOrPage', function () {
            return 'Delete ' + this.get('controller.postOrPage');
        }),
    
        saveText: Ember.computed('controller.willPublish', function () {
            return this.get('controller.willPublish') ? this.get('publishText') : this.get('draftText');
        })
    });
    
    __exports__["default"] = EditorSaveButtonView;
  });
define("ghost/views/editor/edit", 
  ["ghost/mixins/editor-base-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EditorViewMixin = __dependency1__["default"];

    
    var EditorView = Ember.View.extend(EditorViewMixin, {
        tagName: 'section',
        classNames: ['entry-container']
    });
    
    __exports__["default"] = EditorView;
  });
define("ghost/views/editor/new", 
  ["ghost/mixins/editor-base-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EditorViewMixin = __dependency1__["default"];

    
    var EditorNewView = Ember.View.extend(EditorViewMixin, {
        tagName: 'section',
        templateName: 'editor/edit',
        classNames: ['entry-container']
    });
    
    __exports__["default"] = EditorNewView;
  });
define("ghost/views/mobile/content-view", 
  ["ghost/utils/mobile","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var mobileQuery = __dependency1__["default"];

    
    var MobileContentView = Ember.View.extend({
        // Ensure that loading this view brings it into view on mobile
        showContent: function () {
            if (mobileQuery.matches) {
                this.get('parentView').showContent();
            }
        }.on('didInsertElement')
    });
    
    __exports__["default"] = MobileContentView;
  });
define("ghost/views/mobile/index-view", 
  ["ghost/utils/mobile","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var mobileQuery = __dependency1__["default"];

    
    var MobileIndexView = Ember.View.extend({
        // Ensure that going to the index brings the menu into view on mobile.
        showMenu: function () {
            if (mobileQuery.matches) {
                this.get('parentView').showMenu();
            }
        }.on('didInsertElement')
    });
    
    __exports__["default"] = MobileIndexView;
  });
define("ghost/views/mobile/parent-view", 
  ["ghost/utils/mobile","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var mobileQuery = __dependency1__["default"];

    
    // A mobile parent view needs to implement three methods,
    // showContent, showAll, and showMenu
    // Which are called by MobileIndex and MobileContent views
    var MobileParentView = Ember.View.extend({
        showContent: Ember.K,
        showMenu: Ember.K,
        showAll: Ember.K,
    
        setChangeLayout: function () {
            var self = this;
            this.set('changeLayout', function changeLayout() {
                if (mobileQuery.matches) {
                    // transitioned to mobile layout, so show content
                    self.showContent();
                } else {
                    // went from mobile to desktop
                    self.showAll();
                }
            });
        }.on('init'),
    
        attachChangeLayout: function () {
            mobileQuery.addListener(this.changeLayout);
        }.on('didInsertElement'),
    
        detachChangeLayout: function () {
            mobileQuery.removeListener(this.changeLayout);
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = MobileParentView;
  });
define("ghost/views/paginated-scroll-box", 
  ["ghost/utils/set-scroll-classname","ghost/mixins/pagination-view-infinite-scroll","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var setScrollClassName = __dependency1__["default"];

    var PaginationViewMixin = __dependency2__["default"];

    
    var PaginatedScrollBox = Ember.View.extend(PaginationViewMixin, {
        attachScrollClassHandler: function () {
            var el = this.$();
            el.on('scroll', Ember.run.bind(el, setScrollClassName, {
                target: el.closest('.content-list'),
                offset: 10
            }));
        }.on('didInsertElement'),
    
        detachScrollClassHandler: function () {
            this.$().off('scroll');
        }.on('willDestroyElement')
    });
    
    __exports__["default"] = PaginatedScrollBox;
  });
define("ghost/views/post-item-view", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PostItemView = Ember.View.extend({
        classNameBindings: ['active', 'isFeatured:featured', 'isPage:page'],
    
        active: null,
    
        isFeatured: Ember.computed.alias('controller.model.featured'),
    
        isPage: Ember.computed.alias('controller.model.page'),
    
        doubleClick: function () {
            this.get('controller').send('openEditor');
        },
    
        click: function () {
            this.get('controller').send('showPostContent');
        },
        scrollIntoView: function () {
            if (!this.get('active')) {
                return;
            }
            var element = this.$(),
                offset = element.offset().top,
                elementHeight = element.height(),
                container = Ember.$('.js-content-scrollbox'),
                containerHeight = container.height(),
                currentScroll = container.scrollTop(),
                isBelowTop,
                isAboveBottom,
                isOnScreen;
    
            isAboveBottom = offset < containerHeight;
            isBelowTop = offset > elementHeight;
    
            isOnScreen = isBelowTop && isAboveBottom;
    
            if (!isOnScreen) {
                // Scroll so that element is centered in container
                // 40 is the amount of padding on the container
                container.clearQueue().animate({
                    scrollTop: currentScroll + offset - 40 - containerHeight / 2
                });
            }
        },
        removeScrollBehaviour: function () {
            this.removeObserver('active', this, this.scrollIntoView);
        }.on('willDestroyElement'),
        addScrollBehaviour: function () {
            this.addObserver('active', this, this.scrollIntoView);
        }.on('didInsertElement')
    });
    
    __exports__["default"] = PostItemView;
  });
define("ghost/views/post-tags-input", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var PostTagsInputView = Ember.View.extend({
        tagName: 'section',
        elementId: 'entry-tags',
        classNames: 'publish-bar-inner',
        classNameBindings: ['hasFocus:focused'],
    
        hasFocus: false,
    
        keys: {
            BACKSPACE: 8,
            TAB: 9,
            ENTER: 13,
            ESCAPE: 27,
            UP: 38,
            DOWN: 40,
            NUMPAD_ENTER: 108
        },
    
        didInsertElement: function () {
            this.get('controller').send('loadAllTags');
        },
    
        willDestroyElement: function () {
            this.get('controller').send('reset');
        },
    
        overlayStyles: Ember.computed('hasFocus', 'controller.suggestions.length', function () {
            var styles = [],
                leftPos;
    
            if (this.get('hasFocus') && this.get('controller.suggestions.length')) {
                leftPos = this.$().find('#tags').position().left;
                styles.push('display: block');
                styles.push('left: ' + leftPos + 'px');
            } else {
                styles.push('display: none');
                styles.push('left', 0);
            }
    
            return styles.join(';');
        }),
    
        tagInputView: Ember.TextField.extend({
            focusIn: function () {
                this.get('parentView').set('hasFocus', true);
            },
    
            focusOut: function () {
                this.get('parentView').set('hasFocus', false);
            },
    
            keyPress: function (event) {
                // listen to keypress event to handle comma key on international keyboard
                var controller = this.get('parentView.controller'),
                    isComma = ','.localeCompare(String.fromCharCode(event.keyCode || event.charCode)) === 0;
    
                // use localeCompare in case of international keyboard layout
                if (isComma) {
                    event.preventDefault();
    
                    if (controller.get('selectedSuggestion')) {
                        controller.send('addSelectedSuggestion');
                    } else {
                        controller.send('addNewTag');
                    }
                }
            },
    
            keyDown: function (event) {
                var controller = this.get('parentView.controller'),
                    keys = this.get('parentView.keys'),
                    hasValue;
    
                switch (event.keyCode) {
                    case keys.UP:
                        event.preventDefault();
                        controller.send('selectPreviousSuggestion');
                        break;
    
                    case keys.DOWN:
                        event.preventDefault();
                        controller.send('selectNextSuggestion');
                        break;
    
                    case keys.TAB:
                    case keys.ENTER:
                    case keys.NUMPAD_ENTER:
                        if (controller.get('selectedSuggestion')) {
                            event.preventDefault();
                            controller.send('addSelectedSuggestion');
                        } else {
                            // allow user to tab out of field if input is empty
                            hasValue = !Ember.isEmpty(this.get('value'));
                            if (hasValue || event.keyCode !== keys.TAB) {
                                event.preventDefault();
                                controller.send('addNewTag');
                            }
                        }
                        break;
    
                    case keys.BACKSPACE:
                        if (Ember.isEmpty(this.get('value'))) {
                            event.preventDefault();
                            controller.send('deleteLastTag');
                        }
                        break;
    
                    case keys.ESCAPE:
                        event.preventDefault();
                        controller.send('reset');
                        break;
                }
            }
        }),
    
        suggestionView: Ember.View.extend({
            tagName: 'li',
            classNameBindings: 'suggestion.selected',
    
            suggestion: null,
    
            // we can't use the 'click' event here as the focusOut event on the
            // input will fire first
    
            mouseDown: function (event) {
                event.preventDefault();
            },
    
            mouseUp: function (event) {
                event.preventDefault();
                this.get('parentView.controller').send('addTag',
                    this.get('suggestion.tag'));
            }
        }),
    
        actions: {
            deleteTag: function (tag) {
                // The view wants to keep focus on the input after a click on a tag
                Ember.$('.js-tag-input').focus();
                // Make the controller do the actual work
                this.get('controller').send('deleteTag', tag);
            }
        }
    });
    
    __exports__["default"] = PostTagsInputView;
  });
define("ghost/views/posts", 
  ["ghost/views/mobile/parent-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileParentView = __dependency1__["default"];

    
    var PostsView = MobileParentView.extend({
        classNames: ['content-view-container'],
        tagName: 'section',
    
        // Mobile parent view callbacks
        showMenu: function () {
            $('.js-content-list, .js-content-preview').addClass('show-menu').removeClass('show-content');
        },
        showContent: function () {
            $('.js-content-list, .js-content-preview').addClass('show-content').removeClass('show-menu');
        },
        showAll: function () {
            $('.js-content-list, .js-content-preview').removeClass('show-menu show-content');
        }
    });
    
    __exports__["default"] = PostsView;
  });
define("ghost/views/posts/index", 
  ["ghost/views/mobile/index-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileIndexView = __dependency1__["default"];

    
    var PostsIndexView = MobileIndexView.extend({
        classNames: ['no-posts-box']
    });
    
    __exports__["default"] = PostsIndexView;
  });
define("ghost/views/posts/post", 
  ["ghost/views/mobile/content-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileContentView = __dependency1__["default"];

    
    var PostsPostView = MobileContentView.extend();
    
    __exports__["default"] = PostsPostView;
  });
define("ghost/views/settings", 
  ["ghost/views/mobile/parent-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileParentView = __dependency1__["default"];

    
    var SettingsView = MobileParentView.extend({
        // MobileParentView callbacks
        showMenu: function () {
            $('.js-settings-header-inner').css('display', 'none');
            $('.js-settings-menu').css({right: '0', left: '0', 'margin-right': '0'});
            $('.js-settings-content').css({right: '-100%', left: '100%', 'margin-left': '15'});
        },
        showContent: function () {
            $('.js-settings-menu').css({right: '100%', left: '-110%', 'margin-right': '15px'});
            $('.js-settings-content').css({right: '0', left: '0', 'margin-left': '0'});
            $('.js-settings-header-inner').css('display', 'block');
        },
        showAll: function () {
            $('.js-settings-menu, .js-settings-content').removeAttr('style');
        }
    });
    
    __exports__["default"] = SettingsView;
  });
define("ghost/views/settings/about", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsAboutView = BaseView.extend();
    
    __exports__["default"] = SettingsAboutView;
  });
define("ghost/views/settings/apps", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsAppsView = BaseView.extend();
    
    __exports__["default"] = SettingsAppsView;
  });
define("ghost/views/settings/code-injection", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsGeneralView = BaseView.extend();
    
    __exports__["default"] = SettingsGeneralView;
  });
define("ghost/views/settings/content-base", 
  ["ghost/views/mobile/content-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileContentView = __dependency1__["default"];

    /**
     * All settings views other than the index should inherit from this base class.
     * It ensures that the correct screen is showing when a mobile user navigates
     * to a `settings.someRouteThatIsntIndex` route.
     */
    
    var SettingsContentBaseView = MobileContentView.extend({
        tagName: 'section',
        classNames: ['settings-content', 'js-settings-content', 'fade-in']
    });
    
    __exports__["default"] = SettingsContentBaseView;
  });
define("ghost/views/settings/general", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsGeneralView = BaseView.extend();
    
    __exports__["default"] = SettingsGeneralView;
  });
define("ghost/views/settings/index", 
  ["ghost/views/mobile/index-view","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MobileIndexView = __dependency1__["default"];

    
    var SettingsIndexView = MobileIndexView.extend();
    
    __exports__["default"] = SettingsIndexView;
  });
define("ghost/views/settings/labs", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsLabsView = BaseView.extend();
    
    __exports__["default"] = SettingsLabsView;
  });
define("ghost/views/settings/navigation", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsNavigationView = BaseView.extend({
    
        didInsertElement: function () {
            var controller = this.get('controller'),
                navContainer = Ember.$('.js-settings-navigation'),
                navElements = '.navigation-item:not(.navigation-item:last-child)';
    
            navContainer.sortable({
                handle: '.navigation-item-drag-handle',
                items: navElements,
    
                update: function () {
                    var indexes = [];
                    navContainer.find(navElements).each(function () {
                        var order = Ember.$(this).data('order');
                        indexes.push(order);
                    });
                    controller.updateOrder(indexes);
                }
            });
        },
    
        willDestroyElement: function () {
            Ember.$('.js-settings-navigation').sortable('destroy');
        }
    
    });
    
    __exports__["default"] = SettingsNavigationView;
  });
define("ghost/views/settings/tags", 
  ["ghost/views/settings/content-base","ghost/mixins/pagination-view-infinite-scroll","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    var PaginationScrollMixin = __dependency2__["default"];

    
    var SettingsTagsView = BaseView.extend(PaginationScrollMixin);
    
    __exports__["default"] = SettingsTagsView;
  });
define("ghost/views/settings/tags/settings-menu", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var TagsSettingsMenuView = Ember.View.extend({
        saveText: Ember.computed('controller.model.isNew', function () {
            return this.get('controller.model.isNew') ?
                'Add Tag' :
                'Save Tag';
        }),
    
        // This observer loads and resets the uploader whenever the active tag changes,
        // ensuring that we can reuse the whole settings menu.
        updateUploader: Ember.observer('controller.activeTag.image', 'controller.uploaderReference', function () {
            var uploader = this.get('controller.uploaderReference'),
                image = this.get('controller.activeTag.image');
    
            if (uploader && uploader[0]) {
                if (image) {
                    uploader[0].uploaderUi.initWithImage();
                } else {
                    uploader[0].uploaderUi.reset();
                }
            }
        })
    });
    
    __exports__["default"] = TagsSettingsMenuView;
  });
define("ghost/views/settings/users", 
  ["ghost/views/settings/content-base","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var BaseView = __dependency1__["default"];

    
    var SettingsUsersView = BaseView.extend();
    
    __exports__["default"] = SettingsUsersView;
  });
define("ghost/views/settings/users/user", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var SettingsUserView = Ember.View.extend({
        currentUser: Ember.computed.alias('controller.session.user'),
    
        isNotOwnProfile: Ember.computed('controller.user.id', 'currentUser.id', function () {
            return this.get('controller.user.id') !== this.get('currentUser.id');
        }),
    
        isNotOwnersProfile: Ember.computed.not('controller.user.isOwner'),
    
        canAssignRoles: Ember.computed.or('currentUser.isAdmin', 'currentUser.isOwner'),
    
        canMakeOwner: Ember.computed.and('currentUser.isOwner', 'isNotOwnProfile', 'controller.user.isAdmin'),
    
        rolesDropdownIsVisible: Ember.computed.and('isNotOwnProfile', 'canAssignRoles', 'isNotOwnersProfile'),
    
        deleteUserActionIsVisible: Ember.computed('currentUser', 'canAssignRoles', 'controller.user', function () {
            if ((this.get('canAssignRoles') && this.get('isNotOwnProfile') && !this.get('controller.user.isOwner')) ||
                (this.get('currentUser.isEditor') && (this.get('isNotOwnProfile') ||
                this.get('controller.user.isAuthor')))) {
                return true;
            }
        }),
    
        userActionsAreVisible: Ember.computed.or('deleteUserActionIsVisible', 'canMakeOwner')
    
    });
    
    __exports__["default"] = SettingsUserView;
  });
define("ghost/views/settings/users/users-list-view", 
  ["ghost/mixins/pagination-view-infinite-scroll","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var PaginationViewMixin = __dependency1__["default"];

    
    var UsersListView = Ember.View.extend(PaginationViewMixin, {
        classNames: ['js-users-list-view']
    });
    
    __exports__["default"] = UsersListView;
  });
define('ghost/templates/-contributors', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/jaswilli");
      dom.setAttribute(el2,"title","jaswilli");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","jaswilli");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/ErisDS");
      dom.setAttribute(el2,"title","ErisDS");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","ErisDS");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/PaulAdamDavis");
      dom.setAttribute(el2,"title","PaulAdamDavis");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","PaulAdamDavis");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/cobbspur");
      dom.setAttribute(el2,"title","cobbspur");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","cobbspur");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/felixrieseberg");
      dom.setAttribute(el2,"title","felixrieseberg");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","felixrieseberg");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/rwjblue");
      dom.setAttribute(el2,"title","rwjblue");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","rwjblue");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/JohnONolan");
      dom.setAttribute(el2,"title","JohnONolan");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","JohnONolan");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/halfdan");
      dom.setAttribute(el2,"title","halfdan");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","halfdan");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/sebgie");
      dom.setAttribute(el2,"title","sebgie");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","sebgie");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/Gargol");
      dom.setAttribute(el2,"title","Gargol");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","Gargol");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/ekulabuhov");
      dom.setAttribute(el2,"title","ekulabuhov");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","ekulabuhov");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/jgable");
      dom.setAttribute(el2,"title","jgable");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","jgable");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/novaugust");
      dom.setAttribute(el2,"title","novaugust");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","novaugust");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("li");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"href","https://github.com/dbalders");
      dom.setAttribute(el2,"title","dbalders");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("img");
      dom.setAttribute(el3,"alt","dbalders");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, subexpr = hooks.subexpr, concat = hooks.concat, attribute = hooks.attribute;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1, 1]);
      var element1 = dom.childAt(fragment, [2, 1, 1]);
      var element2 = dom.childAt(fragment, [4, 1, 1]);
      var element3 = dom.childAt(fragment, [6, 1, 1]);
      var element4 = dom.childAt(fragment, [8, 1, 1]);
      var element5 = dom.childAt(fragment, [10, 1, 1]);
      var element6 = dom.childAt(fragment, [12, 1, 1]);
      var element7 = dom.childAt(fragment, [14, 1, 1]);
      var element8 = dom.childAt(fragment, [16, 1, 1]);
      var element9 = dom.childAt(fragment, [18, 1, 1]);
      var element10 = dom.childAt(fragment, [20, 1, 1]);
      var element11 = dom.childAt(fragment, [22, 1, 1]);
      var element12 = dom.childAt(fragment, [24, 1, 1]);
      var element13 = dom.childAt(fragment, [26, 1, 1]);
      var attrMorph0 = dom.createAttrMorph(element0, 'src');
      var attrMorph1 = dom.createAttrMorph(element1, 'src');
      var attrMorph2 = dom.createAttrMorph(element2, 'src');
      var attrMorph3 = dom.createAttrMorph(element3, 'src');
      var attrMorph4 = dom.createAttrMorph(element4, 'src');
      var attrMorph5 = dom.createAttrMorph(element5, 'src');
      var attrMorph6 = dom.createAttrMorph(element6, 'src');
      var attrMorph7 = dom.createAttrMorph(element7, 'src');
      var attrMorph8 = dom.createAttrMorph(element8, 'src');
      var attrMorph9 = dom.createAttrMorph(element9, 'src');
      var attrMorph10 = dom.createAttrMorph(element10, 'src');
      var attrMorph11 = dom.createAttrMorph(element11, 'src');
      var attrMorph12 = dom.createAttrMorph(element12, 'src');
      var attrMorph13 = dom.createAttrMorph(element13, 'src');
      attribute(env, attrMorph0, element0, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/jaswilli"]));
      attribute(env, attrMorph1, element1, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/ErisDS"]));
      attribute(env, attrMorph2, element2, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/PaulAdamDavis"]));
      attribute(env, attrMorph3, element3, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/cobbspur"]));
      attribute(env, attrMorph4, element4, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/felixrieseberg"]));
      attribute(env, attrMorph5, element5, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/rwjblue"]));
      attribute(env, attrMorph6, element6, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/JohnONolan"]));
      attribute(env, attrMorph7, element7, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/halfdan"]));
      attribute(env, attrMorph8, element8, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/sebgie"]));
      attribute(env, attrMorph9, element9, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/Gargol"]));
      attribute(env, attrMorph10, element10, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/ekulabuhov"]));
      attribute(env, attrMorph11, element11, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/jgable"]));
      attribute(env, attrMorph12, element12, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/novaugust"]));
      attribute(env, attrMorph13, element13, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/contributors"], {}), "/dbalders"]));
      return fragment;
    }
  };
}())); });

define('ghost/templates/-import-errors', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("tr");
          var el2 = dom.createElement("td");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1, 0]),-1,-1);
          content(env, morph0, context, "error.message");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("table");
        dom.setAttribute(el1,"class","table");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),0,-1);
        block(env, morph0, context, "each", [get(env, context, "importErrors")], {"keyword": "error"}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "if", [get(env, context, "importErrors")], {}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/-navbar', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","nav-label");
        var el2 = dom.createElement("i");
        dom.setAttribute(el2,"class","icon-content");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" Content");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","nav-label");
        var el2 = dom.createElement("i");
        dom.setAttribute(el2,"class","icon-add");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" New Post");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","nav-label");
          var el2 = dom.createElement("i");
          dom.setAttribute(el2,"class","icon-settings2");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(" Settings");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        block(env, morph0, context, "link-to", ["settings"], {"classNames": "nav-item nav-settings js-nav-item"}, child0, null);
        return fragment;
      }
    };
  }());
  var child3 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","image");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("img");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","name");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("i");
        dom.setAttribute(el2,"class","icon-chevron-down");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("small");
        var el3 = dom.createTextNode("Profile & Settings");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [1]);
        var element2 = dom.childAt(element1, [1]);
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [3]),0,1);
        element(env, element1, context, "bind-attr", [], {"style": get(env, context, "userImageBackground")});
        element(env, element2, context, "bind-attr", [], {"src": "userImage", "title": "userImageAlt"});
        content(env, morph0, context, "session.user.name");
        return fragment;
      }
    };
  }());
  var child4 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("i");
          dom.setAttribute(el1,"class","icon-user");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" Your Profile");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("i");
          dom.setAttribute(el1,"class","icon-power");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" Sign Out");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("ul");
        dom.setAttribute(el1,"class","dropdown-menu dropdown-triangle-top-right js-user-menu-dropdown-menu");
        dom.setAttribute(el1,"role","menu");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"role","presentation");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"role","presentation");
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"class","dropdown-item user-menu-support");
        dom.setAttribute(el3,"role","menuitem");
        dom.setAttribute(el3,"tabindex","-1");
        dom.setAttribute(el3,"href","http://support.ghost.org/");
        var el4 = dom.createElement("i");
        dom.setAttribute(el4,"class","icon-support");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode(" Help / Support");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"class","divider");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"role","presentation");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),-1,-1);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [7]),-1,-1);
        block(env, morph0, context, "link-to", ["settings.users.user", get(env, context, "session.user.slug")], {"classNames": "dropdown-item user-menu-profile js-nav-item", "role": "menuitem", "tabindex": "-1"}, child0, null);
        block(env, morph1, context, "link-to", ["signout"], {"classNames": "dropdown-item user-menu-signout", "role": "menuitem", "tabindex": "-1"}, child1, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("nav");
      dom.setAttribute(el1,"class","global-nav");
      dom.setAttribute(el1,"role","navigation");
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("a");
      dom.setAttribute(el2,"class","nav-item ghost-logo");
      dom.setAttribute(el2,"title","Visit blog");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","nav-label");
      var el4 = dom.createElement("i");
      dom.setAttribute(el4,"class","icon-ghost");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode(" ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("span");
      var el5 = dom.createTextNode("Visit blog");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode(" ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("div");
      dom.setAttribute(el2,"class","nav-item user-menu");
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","nav-cover js-nav-cover");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, subexpr = hooks.subexpr, concat = hooks.concat, attribute = hooks.attribute, block = hooks.block, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element3 = dom.childAt(fragment, [0]);
      var element4 = dom.childAt(element3, [1]);
      var element5 = dom.childAt(element3, [6]);
      if (this.cachedFragment) { dom.repairClonedNode(element5,[1]); }
      var attrMorph0 = dom.createAttrMorph(element4, 'href');
      var morph0 = dom.createMorphAt(element3,2,3);
      var morph1 = dom.createMorphAt(element3,3,4);
      var morph2 = dom.createMorphAt(element3,4,5);
      var morph3 = dom.createMorphAt(element5,0,1);
      var morph4 = dom.createMorphAt(element5,1,2);
      attribute(env, attrMorph0, element4, "href", concat(env, [subexpr(env, context, "gh-path", ["blog"], {})]));
      block(env, morph0, context, "link-to", ["posts"], {"classNames": "nav-item nav-content js-nav-item"}, child0, null);
      block(env, morph1, context, "link-to", ["editor.new"], {"classNames": "nav-item nav-new js-nav-item"}, child1, null);
      block(env, morph2, context, "unless", [get(env, context, "session.user.isAuthor")], {}, child2, null);
      block(env, morph3, context, "gh-dropdown-button", [], {"dropdownName": "user-menu", "tagName": "div", "classNames": "nav-label clearfix"}, child3, null);
      block(env, morph4, context, "gh-dropdown", [], {"tagName": "div", "classNames": "dropdown", "name": "user-menu", "closeOnClick": "true"}, child4, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/-publish-bar', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("footer");
      dom.setAttribute(el1,"id","publish-bar");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("div");
      dom.setAttribute(el2,"class","publish-bar-inner");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","publish-bar-actions");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("button");
      dom.setAttribute(el4,"type","button");
      dom.setAttribute(el4,"class","post-settings");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, inline = hooks.inline, element = hooks.element;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(element0, [2]);
      var element2 = dom.childAt(element1, [1]);
      var morph0 = dom.createMorphAt(element0,0,1);
      var morph1 = dom.createMorphAt(element1,2,3);
      inline(env, morph0, context, "render", ["post-tags-input"], {});
      element(env, element2, context, "action", ["toggleSettingsMenu"], {});
      inline(env, morph1, context, "view", ["editor-save-button"], {"id": "entry-actions", "classNameBindings": "model.isNew:unsaved"});
      return fragment;
    }
  };
}())); });

define('ghost/templates/-user-actions-menu', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("li");
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("Make Owner");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [0, 0]);
        element(env, element1, context, "action", ["openModal", "transfer-owner", get(env, context, "this")], {});
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("li");
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"class","delete");
        var el3 = dom.createTextNode("Delete User");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 0]);
        element(env, element0, context, "action", ["openModal", "delete-user", get(env, context, "this")], {});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1,2]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      var morph1 = dom.createMorphAt(fragment,1,2,contextualElement);
      block(env, morph0, context, "if", [get(env, context, "view.canMakeOwner")], {}, child0, null);
      block(env, morph1, context, "if", [get(env, context, "view.deleteUserActionIsVisible")], {}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/application', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "partial", ["navbar"], {});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("a");
      dom.setAttribute(el1,"class","sr-only sr-only-focusable");
      dom.setAttribute(el1,"href","#gh-main");
      var el2 = dom.createTextNode("Skip to main content");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("main");
      dom.setAttribute(el1,"id","gh-main");
      dom.setAttribute(el1,"class","viewport");
      dom.setAttribute(el1,"role","main");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block, element = hooks.element, inline = hooks.inline, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [3]);
      var morph0 = dom.createMorphAt(fragment,1,2,contextualElement);
      var morph1 = dom.createMorphAt(element0,0,1);
      var morph2 = dom.createMorphAt(element0,1,2);
      var morph3 = dom.createMorphAt(element0,2,3);
      var morph4 = dom.createMorphAt(fragment,4,5,contextualElement);
      var morph5 = dom.createMorphAt(fragment,5,6,contextualElement);
      block(env, morph0, context, "unless", [get(env, context, "hideNav")], {}, child0, null);
      element(env, element0, context, "bind-attr", [], {"data-notification-count": get(env, context, "topNotificationCount")});
      inline(env, morph1, context, "gh-notifications", [], {"location": "top", "notify": "topNotificationChange"});
      inline(env, morph2, context, "gh-notifications", [], {"location": "bottom"});
      content(env, morph3, context, "outlet");
      inline(env, morph4, context, "outlet", ["modal"], {});
      inline(env, morph5, context, "outlet", ["settings-menu"], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-activating-list-item', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1,2]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        var morph1 = dom.createMorphAt(fragment,1,2,contextualElement);
        content(env, morph0, context, "title");
        content(env, morph1, context, "yield");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "link-to", [get(env, context, "route")], {"alternateActive": get(env, context, "active")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-file-upload', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("    ");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("input");
      dom.setAttribute(el1,"data-url","upload");
      dom.setAttribute(el1,"class","btn btn-green");
      dom.setAttribute(el1,"type","file");
      dom.setAttribute(el1,"name","importfile");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n    ");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("button");
      dom.setAttribute(el1,"type","submit");
      dom.setAttribute(el1,"class","btn btn-blue");
      dom.setAttribute(el1,"id","startupload");
      var el2 = dom.createTextNode("\n        ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [1]);
      var element1 = dom.childAt(fragment, [3]);
      var morph0 = dom.createMorphAt(element1,0,1);
      element(env, element0, context, "bind-attr", [], {"accept": get(env, context, "options.acceptEncoding")});
      element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "uploadButtonDisabled")});
      element(env, element1, context, "action", ["upload"], {});
      content(env, morph0, context, "uploadButtonText");
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-markdown', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      inline(env, morph0, context, "gh-format-markdown", [get(env, context, "markdown")], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-modal-dialog', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createElement("header");
        dom.setAttribute(el0,"class","modal-header");
        var el1 = dom.createElement("h1");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),-1,-1);
        content(env, morph0, context, "title");
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createElement("a");
        dom.setAttribute(el0,"class","close");
        dom.setAttribute(el0,"href","");
        dom.setAttribute(el0,"title","Close");
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","hidden");
        var el2 = dom.createTextNode("Close");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element3 = fragment;
        element(env, element3, context, "action", ["closeModal"], {});
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("footer");
        dom.setAttribute(el1,"class","modal-footer");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"type","button");
        var el3 = dom.createTextNode("\n                    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("\n                Required to strip the white-space between buttons\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"type","button");
        var el3 = dom.createTextNode("\n                    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var element1 = dom.childAt(element0, [1]);
        var element2 = dom.childAt(element0, [3]);
        var morph0 = dom.createMorphAt(element1,0,1);
        var morph1 = dom.createMorphAt(element2,0,1);
        element(env, element1, context, "bind-attr", [], {"class": "rejectButtonClass :js-button-reject"});
        element(env, element1, context, "action", ["confirm", "reject"], {});
        content(env, morph0, context, "confirm.reject.text");
        element(env, element2, context, "bind-attr", [], {"class": "acceptButtonClass :js-button-accept"});
        element(env, element2, context, "action", ["confirm", "accept"], {});
        content(env, morph1, context, "confirm.accept.text");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","modal-container js-modal-container");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("article");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"class","modal-content");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("section");
      dom.setAttribute(el4,"class","modal-body");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","modal-background js-modal-background");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, get = hooks.get, block = hooks.block, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element4 = dom.childAt(fragment, [0]);
      var element5 = dom.childAt(element4, [1]);
      var element6 = dom.childAt(element5, [1]);
      var morph0 = dom.createMorphAt(element6,0,1);
      var morph1 = dom.createMorphAt(element6,1,2);
      var morph2 = dom.createMorphAt(dom.childAt(element6, [3]),0,1);
      var morph3 = dom.createMorphAt(element6,4,5);
      element(env, element4, context, "action", ["closeModal"], {});
      element(env, element5, context, "bind-attr", [], {"class": "klass :js-modal"});
      element(env, element6, context, "action", ["noBubble"], {"bubbles": false, "preventDefault": false});
      block(env, morph0, context, "if", [get(env, context, "title")], {}, child0, null);
      block(env, morph1, context, "if", [get(env, context, "showClose")], {}, child1, null);
      content(env, morph2, context, "yield");
      block(env, morph3, context, "if", [get(env, context, "confirm")], {}, child2, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-navitem', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","navigation-item-drag-handle icon-grab");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","hidden");
        var el3 = dom.createTextNode("Reorder");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","add-navigation-link icon-add");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","hidden");
        var el3 = dom.createTextNode("Add");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [1]);
        element(env, element1, context, "action", ["addItem"], {});
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","navigation-delete icon-trash");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","hidden");
        var el3 = dom.createTextNode("Delete");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        element(env, element0, context, "action", ["deleteItem", get(env, context, "navItem")], {});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","navigation-inputs");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("span");
      dom.setAttribute(el2,"class","navigation-item-label");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("span");
      dom.setAttribute(el2,"class","navigation-item-url");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("span");
      dom.setAttribute(el1,"class","navigation-item-action");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
      var element2 = dom.childAt(fragment, [1]);
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      var morph1 = dom.createMorphAt(dom.childAt(element2, [1]),0,1);
      var morph2 = dom.createMorphAt(dom.childAt(element2, [3]),0,1);
      var morph3 = dom.createMorphAt(dom.childAt(fragment, [3]),0,-1);
      block(env, morph0, context, "unless", [get(env, context, "navItem.last")], {}, child0, null);
      inline(env, morph1, context, "gh-trim-focus-input", [], {"focus": get(env, context, "navItem.last"), "placeholder": "Label", "value": get(env, context, "navItem.label")});
      inline(env, morph2, context, "gh-navitem-url-input", [], {"baseUrl": get(env, context, "baseUrl"), "url": get(env, context, "navItem.url"), "change": "updateUrl"});
      block(env, morph3, context, "if", [get(env, context, "navItem.last")], {}, child1, child2);
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-notification', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createElement("section");
      var el1 = dom.createTextNode("\n    ");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("span");
      dom.setAttribute(el1,"class","notification-message");
      var el2 = dom.createTextNode("\n        ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n    ");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("button");
      dom.setAttribute(el1,"class","close");
      var el2 = dom.createElement("span");
      dom.setAttribute(el2,"class","hidden");
      var el3 = dom.createTextNode("Close");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = fragment;
      var element1 = dom.childAt(element0, [3]);
      var morph0 = dom.createUnsafeMorphAt(dom.childAt(element0, [1]),0,1);
      element(env, element0, context, "bind-attr", [], {"class": ":js-notification typeClass"});
      content(env, morph0, context, "message.message");
      element(env, element1, context, "action", ["closeNotification"], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-notifications', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-notification", [], {"message": get(env, context, "message")});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "each", [get(env, context, "messages")], {"keyword": "message"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-role-selector', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("option");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(element0,-1,-1);
        element(env, element0, context, "bind-attr", [], {"value": get(env, context, "role.id")});
        content(env, morph0, context, "role.name");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("select");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, element = hooks.element, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element1 = dom.childAt(fragment, [0]);
      var morph0 = dom.createMorphAt(element1,0,-1);
      element(env, element1, context, "bind-attr", [], {"id": get(env, context, "selectId"), "name": get(env, context, "selectName")});
      block(env, morph0, context, "each", [get(env, context, "roles")], {"keyword": "role"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-uploader', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("span");
      dom.setAttribute(el1,"class","media");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("span");
      dom.setAttribute(el2,"class","hidden");
      var el3 = dom.createTextNode("Image Upload");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("img");
      dom.setAttribute(el1,"class","js-upload-target");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","description");
      var el2 = dom.createElement("strong");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("input");
      dom.setAttribute(el1,"data-url","upload");
      dom.setAttribute(el1,"class","js-fileupload main fileupload");
      dom.setAttribute(el1,"type","file");
      dom.setAttribute(el1,"name","uploadimage");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [2]);
      var morph0 = dom.createMorphAt(dom.childAt(fragment, [4]),-1,0);
      element(env, element0, context, "bind-attr", [], {"src": get(env, context, "imageSource")});
      content(env, morph0, context, "description");
      return fragment;
    }
  };
}())); });

define('ghost/templates/components/gh-url-preview', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      content(env, morph0, context, "url");
      return fragment;
    }
  };
}())); });

define('ghost/templates/editor-save-button', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("i");
        dom.setAttribute(el1,"class","options");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","sr-only");
        var el2 = dom.createTextNode("Toggle Settings Menu");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("ul");
        dom.setAttribute(el1,"class","dropdown-menu dropdown-triangle-bottom-right");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"class","divider delete");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("li");
        dom.setAttribute(el2,"class","delete");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, content = hooks.content, get = hooks.get;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var element1 = dom.childAt(element0, [1]);
        var element2 = dom.childAt(element1, [1]);
        var element3 = dom.childAt(element0, [3]);
        var element4 = dom.childAt(element3, [1]);
        var element5 = dom.childAt(element0, [7, 1]);
        var morph0 = dom.createMorphAt(element2,-1,-1);
        var morph1 = dom.createMorphAt(element4,-1,-1);
        var morph2 = dom.createMorphAt(element5,-1,-1);
        element(env, element1, context, "bind-attr", [], {"class": ":post-save-publish willPublish:active"});
        element(env, element2, context, "action", ["setSaveType", "publish"], {});
        content(env, morph0, context, "view.publishText");
        element(env, element3, context, "bind-attr", [], {"class": ":post-save-draft willPublish::active"});
        element(env, element4, context, "action", ["setSaveType", "draft"], {});
        content(env, morph1, context, "view.draftText");
        element(env, element5, context, "action", ["openModal", "delete-post", get(env, context, "this")], {});
        content(env, morph2, context, "view.deleteText");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("button");
      dom.setAttribute(el1,"type","button");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, content = hooks.content, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[2,3]); }
      var element6 = dom.childAt(fragment, [0]);
      var morph0 = dom.createMorphAt(element6,-1,-1);
      var morph1 = dom.createMorphAt(fragment,1,2,contextualElement);
      var morph2 = dom.createMorphAt(fragment,2,3,contextualElement);
      element(env, element6, context, "action", ["save"], {});
      element(env, element6, context, "bind-attr", [], {"class": ":btn :btn-sm view.isDangerous:btn-red:btn-blue :js-publish-button"});
      content(env, morph0, context, "view.saveText");
      block(env, morph1, context, "gh-dropdown-button", [], {"dropdownName": "post-save-menu", "classNameBindings": ":btn :btn-sm view.isDangerous:btn-red:btn-blue btnopen:active :dropdown-toggle :up"}, child0, null);
      block(env, morph2, context, "gh-dropdown", [], {"name": "post-save-menu", "closeOnClick": "true", "tagName": "div", "classNames": "dropdown editor-options"}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/editor/edit', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","page-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("button");
      dom.setAttribute(el2,"class","menu-button js-menu-button");
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","sr-only");
      var el4 = dom.createTextNode("Menu");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Editor");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","page-content");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("header");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"class","box entry-title");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("header");
      dom.setAttribute(el3,"class","floatingheader");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("small");
      var el5 = dom.createTextNode("Markdown");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("a");
      dom.setAttribute(el4,"class","markdown-help");
      dom.setAttribute(el4,"href","");
      var el5 = dom.createElement("span");
      dom.setAttribute(el5,"class","hidden");
      var el6 = dom.createTextNode("What is Markdown?");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"id","entry-markdown-content");
      dom.setAttribute(el3,"class","entry-markdown-content");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("header");
      dom.setAttribute(el3,"class","floatingheader");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("small");
      var el5 = dom.createTextNode("Preview ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("span");
      dom.setAttribute(el5,"class","entry-word-count js-entry-word-count");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"class","entry-preview-content js-entry-preview-content");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(fragment, [2]);
      var element2 = dom.childAt(element1, [3]);
      var element3 = dom.childAt(element2, [1]);
      var element4 = dom.childAt(element3, [3]);
      var element5 = dom.childAt(element1, [5]);
      var element6 = dom.childAt(element5, [1]);
      var morph0 = dom.createMorphAt(dom.childAt(element1, [1, 1]),0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element2, [3]),0,1);
      var morph2 = dom.createMorphAt(dom.childAt(element6, [1, 1]),-1,-1);
      var morph3 = dom.createMorphAt(dom.childAt(element5, [3]),0,1);
      var morph4 = dom.createMorphAt(element1,6,7);
      element(env, element0, context, "action", ["toggleGlobalMobileNav"], {});
      inline(env, morph0, context, "gh-trim-focus-input", [], {"type": "text", "id": "entry-title", "placeholder": "Your Post Title", "value": get(env, context, "model.titleScratch"), "tabindex": "1", "focus": get(env, context, "shouldFocusTitle")});
      element(env, element2, context, "bind-attr", [], {"class": ":entry-markdown :js-entry-markdown isPreview::active"});
      element(env, element3, context, "action", ["togglePreview", false], {});
      element(env, element4, context, "action", ["openModal", "markdown"], {});
      inline(env, morph1, context, "gh-codemirror", [], {"value": get(env, context, "model.scratch"), "scrollInfo": get(env, context, "view.markdownScrollInfo"), "setCodeMirror": "setCodeMirror", "openModal": "openModal", "typingPause": "autoSave", "focus": get(env, context, "shouldFocusEditor"), "focusCursorAtEnd": get(env, context, "model.isDirty"), "onFocusIn": "autoSaveNew"});
      element(env, element5, context, "bind-attr", [], {"class": ":entry-preview :js-entry-preview isPreview:active"});
      element(env, element6, context, "action", ["togglePreview", true], {});
      inline(env, morph2, context, "gh-count-words", [get(env, context, "model.scratch")], {});
      inline(env, morph3, context, "gh-markdown", [], {"classNames": "rendered-markdown js-rendered-markdown", "markdown": get(env, context, "model.scratch"), "scrollPosition": get(env, context, "view.scrollPosition"), "uploadStarted": "disableCodeMirror", "uploadFinished": "enableCodeMirror", "uploadSuccess": "handleImgUpload"});
      inline(env, morph4, context, "partial", ["publish-bar"], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/error', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createElement("em");
            dom.setAttribute(el0,"class","error-stack-function");
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, content = hooks.content;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,-1,-1);
            content(env, morph0, context, "item.function");
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createTextNode("\n                    at\n                    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2,"class","error-stack-file");
          var el3 = dom.createTextNode("(");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode(")");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1]);
          var morph0 = dom.createMorphAt(element0,0,1);
          var morph1 = dom.createMorphAt(dom.childAt(element0, [2]),0,1);
          block(env, morph0, context, "if", [get(env, context, "item.function")], {}, child0, null);
          content(env, morph1, context, "item.at");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("section");
        dom.setAttribute(el1,"class","error-stack");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        var el3 = dom.createTextNode("Stack Trace");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createElement("strong");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        dom.setAttribute(el2,"class","error-stack-list");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [1]);
        var morph0 = dom.createMorphAt(dom.childAt(element1, [3, 0]),-1,-1);
        var morph1 = dom.createMorphAt(dom.childAt(element1, [5]),0,1);
        content(env, morph0, context, "message");
        block(env, morph1, context, "each", [get(env, context, "stack")], {"keyword": "item"}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","error-content error-404 js-error-container");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","error-details");
      var el3 = dom.createTextNode("\n         ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("figure");
      dom.setAttribute(el3,"class","error-image");
      var el4 = dom.createTextNode("\n             ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("img");
      dom.setAttribute(el4,"class","error-ghost");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n         ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n         ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"class","error-message");
      var el4 = dom.createTextNode("\n             ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("h1");
      dom.setAttribute(el4,"class","error-code");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n             ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("h2");
      dom.setAttribute(el4,"class","error-description");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n             ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("a");
      dom.setAttribute(el4,"class","error-link");
      var el5 = dom.createTextNode("Go to the front page →");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n         ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, subexpr = hooks.subexpr, concat = hooks.concat, attribute = hooks.attribute, content = hooks.content, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[2]); }
      var element2 = dom.childAt(fragment, [0, 1]);
      var element3 = dom.childAt(element2, [1, 1]);
      var element4 = dom.childAt(element2, [3]);
      var element5 = dom.childAt(element4, [5]);
      var attrMorph0 = dom.createAttrMorph(element3, 'src');
      var attrMorph1 = dom.createAttrMorph(element3, 'srcset');
      var morph0 = dom.createMorphAt(dom.childAt(element4, [1]),-1,-1);
      var morph1 = dom.createMorphAt(dom.childAt(element4, [3]),-1,-1);
      var attrMorph2 = dom.createAttrMorph(element5, 'href');
      var morph2 = dom.createMorphAt(fragment,1,2,contextualElement);
      attribute(env, attrMorph0, element3, "src", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/404-ghost@2x.png"], {})]));
      attribute(env, attrMorph1, element3, "srcset", concat(env, [subexpr(env, context, "gh-path", ["admin", "/img/404-ghost.png"], {}), " 1x, ", subexpr(env, context, "gh-path", ["admin", "/img/404-ghost@2x.png"], {}), " 2x"]));
      content(env, morph0, context, "code");
      content(env, morph1, context, "message");
      attribute(env, attrMorph2, element5, "href", concat(env, [subexpr(env, context, "gh-path", ["blog"], {})]));
      block(env, morph2, context, "if", [get(env, context, "stack")], {}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/forgotten', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","forgotten-box js-forgotten-box fade-in");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","forgotten");
      dom.setAttribute(el2,"class","forgotten-form");
      dom.setAttribute(el2,"method","post");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","email-wrap");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"class","btn btn-blue");
      dom.setAttribute(el3,"type","submit");
      var el4 = dom.createTextNode("Send new password");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, inline = hooks.inline, element = hooks.element;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(element0, [3]);
      var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,1);
      inline(env, morph0, context, "gh-trim-focus-input", [], {"value": get(env, context, "email"), "class": "email", "type": "email", "placeholder": "Email Address", "name": "email", "autofocus": "autofocus", "autocapitalize": "off", "autocorrect": "off"});
      element(env, element1, context, "action", ["submit"], {});
      element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "submitting")});
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/copy-html', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "textarea", [], {"value": get(env, context, "generatedHTML"), "rows": "6"});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "title": "Generated HTML", "confirm": get(env, context, "confirm"), "class": "copy-html"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/delete-all', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        var el2 = dom.createTextNode("This is permanent! No backups, no restores, no magic undo button. ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" We warned you, ok?");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "type": "action", "style": "wide", "title": "Would you really like to delete all content from your blog?", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/delete-post', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        var el2 = dom.createTextNode("You're about to delete \"");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("strong");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\".");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("This is permanent! No backups, no restores, no magic undo button. ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" We warned you, ok?");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [1, 1]),-1,-1);
        content(env, morph0, context, "model.title");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "title": "Are you sure you want to delete this post?", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/delete-tag', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("strong");
          var el2 = dom.createTextNode("WARNING:");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1,"class","red");
          var el2 = dom.createTextNode("This tag is attached to ");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(" ");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(".");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" You're about to delete \"");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("strong");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\". This is permanent! No backups, no restores, no magic undo button. We warned you, ok?\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [3]);
          var morph0 = dom.createMorphAt(element0,0,1);
          var morph1 = dom.createMorphAt(element0,1,2);
          var morph2 = dom.createMorphAt(dom.childAt(fragment, [5]),-1,-1);
          content(env, morph0, context, "model.post_count");
          content(env, morph1, context, "postInflection");
          content(env, morph2, context, "model.name");
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("strong");
          var el2 = dom.createTextNode("WARNING:");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" You're about to delete \"");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("strong");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\". This is permanent! No backups, no restores, no magic undo button. We warned you, ok?\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [3]),-1,-1);
          content(env, morph0, context, "model.name");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        block(env, morph0, context, "if", [get(env, context, "model.post_count")], {}, child0, child1);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "title": "Are you sure you want to delete this tag?", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/delete-user', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("strong");
            var el2 = dom.createTextNode("WARNING:");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode(" ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("span");
            dom.setAttribute(el1,"class","red");
            var el2 = dom.createTextNode("This user is the author of ");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode(" ");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode(".");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode(" All posts and user data will be deleted. There is no way to recover this.\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, content = hooks.content;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element0 = dom.childAt(fragment, [3]);
            var morph0 = dom.createMorphAt(element0,0,1);
            var morph1 = dom.createMorphAt(element0,1,2);
            content(env, morph0, context, "userPostCount.count");
            content(env, morph1, context, "userPostCount.inflection");
            return fragment;
          }
        };
      }());
      var child1 = (function() {
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("strong");
            var el2 = dom.createTextNode("WARNING:");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode(" All user data will be deleted. There is no way to recover this.\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          block(env, morph0, context, "if", [get(env, context, "userPostCount.count")], {}, child0, child1);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        block(env, morph0, context, "unless", [get(env, context, "userPostCount.isPending")], {}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "title": "Are you sure you want to delete this user?", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/invite-new-user', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("fieldset");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","form-group");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"for","new-user-email");
        var el4 = dom.createTextNode("Email Address");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","form-group for-select");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"for","new-user-role");
        var el4 = dom.createTextNode("Role");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),2,3);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),2,3);
        inline(env, morph0, context, "input", [], {"action": "confirmAccept", "class": "email", "id": "new-user-email", "type": "email", "placeholder": "Email Address", "name": "email", "autofocus": "autofocus", "autocapitalize": "off", "autocorrect": "off", "value": get(env, context, "email")});
        inline(env, morph1, context, "gh-role-selector", [], {"initialValue": get(env, context, "authorRole"), "onChange": "setRole", "selectId": "new-user-role"});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "title": "Invite a New User", "confirm": get(env, context, "confirm"), "class": "invite-new-user"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/leave-editor', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        var el2 = dom.createTextNode("Hey there! It looks like you're in the middle of writing something and you haven't saved all of your\n    content.");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        var el2 = dom.createTextNode("Save before you go!");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "title": "Are you sure you want to leave this page?", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/markdown', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("section");
        dom.setAttribute(el1,"class","markdown-help-container");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        dom.setAttribute(el2,"class","modal-markdown-help-table");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("thead");
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("th");
        var el6 = dom.createTextNode("Result");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("th");
        var el6 = dom.createTextNode("Markdown");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("th");
        var el6 = dom.createTextNode("Shortcut");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tbody");
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("strong");
        var el7 = dom.createTextNode("Bold");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("**text**");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + B ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("em");
        var el7 = dom.createTextNode("Emphasize");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("*text*");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + I");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("del");
        var el7 = dom.createTextNode("Strike-through");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("~~text~~");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl + Alt + U");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"href","#");
        var el7 = dom.createTextNode("Link");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("[title](http://)");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + K");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Inline Code");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("`code`");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + Shift + K");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Image");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("![alt](http://)");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + Shift + I");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("List");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("* item");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl + L");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Blockquote");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("> quote");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl + Q");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createElement("mark");
        var el7 = dom.createTextNode("Highlight");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("==Highlight==");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("H1");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("# Heading");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("H2");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("## Heading");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + H");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("tr");
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("H3");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("### Heading");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("td");
        var el6 = dom.createTextNode("Ctrl/⌘ + H (x2)");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        For further Markdown syntax reference: ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("a");
        dom.setAttribute(el2,"href","http://daringfireball.net/projects/markdown/syntax");
        dom.setAttribute(el2,"target","_blank");
        var el3 = dom.createTextNode("Markdown Documentation");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "style": "wide", "title": "Markdown Help"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/signin', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("form");
        dom.setAttribute(el1,"id","login");
        dom.setAttribute(el1,"class","login-form");
        dom.setAttribute(el1,"method","post");
        dom.setAttribute(el1,"novalidate","novalidate");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","password-wrap");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"class","btn btn-blue");
        dom.setAttribute(el2,"type","submit");
        var el3 = dom.createTextNode("Log in");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n       ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var element1 = dom.childAt(element0, [3]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,1);
        element(env, element0, context, "action", ["validateAndAuthenticate"], {"on": "submit"});
        inline(env, morph0, context, "input", [], {"class": "password", "type": "password", "placeholder": "Password", "name": "password", "value": get(env, context, "password")});
        element(env, element1, context, "action", ["validateAndAuthenticate"], {});
        element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "submitting")});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "animation": "fade", "title": "Please re-authenticate", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/transfer-owner', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        var el2 = dom.createTextNode("Are you sure you want to transfer the ownership of this blog? You will not be able to undo this action.");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-modal-dialog", [], {"action": "closeModal", "showClose": true, "type": "action", "style": "wide", "title": "Transfer Ownership", "confirm": get(env, context, "confirm")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/modals/upload', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("  ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("section");
        dom.setAttribute(el1,"class","js-drop-zone");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("img");
        dom.setAttribute(el2,"class","js-upload-target");
        dom.setAttribute(el2,"alt","logo");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("input");
        dom.setAttribute(el2,"data-url","upload");
        dom.setAttribute(el2,"class","js-fileupload main");
        dom.setAttribute(el2,"type","file");
        dom.setAttribute(el2,"name","uploadimage");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var element1 = dom.childAt(element0, [1]);
        var element2 = dom.childAt(element0, [3]);
        element(env, element1, context, "bind-attr", [], {"src": get(env, context, "src")});
        element(env, element2, context, "bind-attr", [], {"accept": get(env, context, "acceptEncoding")});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "gh-upload-modal", [], {"action": "closeModal", "close": true, "type": "action", "style": "wide", "model": get(env, context, "model"), "imageType": get(env, context, "imageType")}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/post-settings-menu', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("            ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","form-group for-select");
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("label");
          dom.setAttribute(el2,"for","author-list");
          var el3 = dom.createTextNode("Author");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2,"class","input-icon icon-user");
          var el3 = dom.createTextNode("\n                    ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("span");
          dom.setAttribute(el3,"class","gh-select");
          dom.setAttribute(el3,"tabindex","0");
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n                ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1, 3, 1]),0,1);
          inline(env, morph0, context, "view", ["select"], {"name": "post-setting-author", "id": "author-list", "content": get(env, context, "authors"), "optionValuePath": "content.id", "optionLabelPath": "content.name", "selection": get(env, context, "selectedAuthor")});
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1,"type","button");
          var el2 = dom.createTextNode("\n                        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("b");
          var el3 = dom.createTextNode("Meta Data");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          var el3 = dom.createTextNode("Extra content for SEO and social media.");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","settings-menu-header subview");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2,"class","back icon-chevron-left settings-menu-header-action");
          var el3 = dom.createElement("span");
          dom.setAttribute(el3,"class","hidden");
          var el4 = dom.createTextNode("Back");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Meta Data");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n\n        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","settings-menu-content");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("form");
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          dom.setAttribute(el4,"for","meta-title");
          var el5 = dom.createTextNode("Meta Title");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("p");
          var el5 = dom.createTextNode("Recommended: ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("b");
          var el6 = dom.createTextNode("70");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode(" characters. You’ve used ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          dom.setAttribute(el4,"for","meta-description");
          var el5 = dom.createTextNode("Meta Description");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("p");
          var el5 = dom.createTextNode("Recommended: ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("b");
          var el6 = dom.createTextNode("156");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode(" characters. You’ve used ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          var el5 = dom.createTextNode("Search Engine Result Preview");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("div");
          dom.setAttribute(el4,"class","seo-preview");
          var el5 = dom.createTextNode("\n                    ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-title");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                    ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-link");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                    ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-description");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1, 1]);
          var element1 = dom.childAt(fragment, [3, 1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [3]);
          var element4 = dom.childAt(element1, [5, 3]);
          var morph0 = dom.createMorphAt(element2,2,3);
          var morph1 = dom.createMorphAt(dom.childAt(element2, [4]),2,-1);
          var morph2 = dom.createMorphAt(element3,2,3);
          var morph3 = dom.createMorphAt(dom.childAt(element3, [4]),2,-1);
          var morph4 = dom.createMorphAt(dom.childAt(element4, [1]),-1,-1);
          var morph5 = dom.createMorphAt(dom.childAt(element4, [3]),-1,-1);
          var morph6 = dom.createMorphAt(dom.childAt(element4, [5]),-1,-1);
          element(env, element0, context, "action", ["closeSubview"], {});
          inline(env, morph0, context, "gh-input", [], {"class": "post-setting-meta-title", "id": "meta-title", "value": get(env, context, "metaTitleScratch"), "name": "post-setting-meta-title", "focus-out": "setMetaTitle", "stopEnterKeyDownPropagation": "true"});
          inline(env, morph1, context, "gh-count-down-characters", [get(env, context, "metaTitleScratch"), 70], {});
          inline(env, morph2, context, "gh-textarea", [], {"class": "post-setting-meta-description", "id": "meta-description", "value": get(env, context, "metaDescriptionScratch"), "name": "post-setting-meta-description", "focus-out": "setMetaDescription", "stopEnterKeyDownPropagation": "true"});
          inline(env, morph3, context, "gh-count-down-characters", [get(env, context, "metaDescriptionScratch"), 156], {});
          content(env, morph4, context, "seoTitle");
          content(env, morph5, context, "seoURL");
          content(env, morph6, context, "seoDescription");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"id","entry-controls");
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","settings-menu-header");
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h4");
        var el5 = dom.createTextNode("Post Settings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4,"class","close icon-x settings-menu-header-action");
        var el5 = dom.createElement("span");
        dom.setAttribute(el5,"class","hidden");
        var el6 = dom.createTextNode("Close");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n        ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","settings-menu-content");
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("form");
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","form-group");
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("label");
        dom.setAttribute(el6,"for","url");
        var el7 = dom.createTextNode("Post URL");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("span");
        dom.setAttribute(el6,"class","input-icon icon-link");
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n            ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n\n            ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","form-group");
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("label");
        dom.setAttribute(el6,"for","post-setting-date");
        var el7 = dom.createTextNode("Publish Date");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("span");
        dom.setAttribute(el6,"class","input-icon icon-calendar");
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n            ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n            ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","nav-list nav-list-block");
        var el6 = dom.createTextNode("\n");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("            ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n\n            ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","form-group for-checkbox");
        var el6 = dom.createTextNode("\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("label");
        dom.setAttribute(el6,"class","checkbox");
        dom.setAttribute(el6,"for","static-page");
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("span");
        dom.setAttribute(el7,"class","input-toggle-component");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("p");
        var el8 = dom.createTextNode("Turn this post into a static page");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n\n                ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("label");
        dom.setAttribute(el6,"class","checkbox");
        dom.setAttribute(el6,"for","featured");
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("span");
        dom.setAttribute(el7,"class","input-toggle-component");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                    ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("p");
        var el8 = dom.createTextNode("Feature this post");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n                ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n            ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n\n            ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n        ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("    ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element5 = dom.childAt(fragment, [0]);
        var element6 = dom.childAt(element5, [1]);
        var element7 = dom.childAt(element6, [1, 3]);
        var element8 = dom.childAt(element6, [3]);
        var element9 = dom.childAt(element8, [2]);
        var element10 = dom.childAt(element9, [1]);
        var element11 = dom.childAt(element9, [8]);
        var element12 = dom.childAt(element11, [1]);
        var element13 = dom.childAt(element11, [3]);
        var element14 = dom.childAt(element5, [3]);
        var morph0 = dom.createMorphAt(element8,0,1);
        var morph1 = dom.createMorphAt(dom.childAt(element10, [3]),0,1);
        var morph2 = dom.createMorphAt(element10,4,5);
        var morph3 = dom.createMorphAt(dom.childAt(element9, [3, 3]),0,1);
        var morph4 = dom.createMorphAt(element9,4,5);
        var morph5 = dom.createMorphAt(dom.childAt(element9, [6]),0,1);
        var morph6 = dom.createMorphAt(element12,0,1);
        var morph7 = dom.createMorphAt(element13,0,1);
        var morph8 = dom.createMorphAt(element14,0,1);
        element(env, element6, context, "bind-attr", [], {"class": "isViewingSubview:settings-menu-pane-out-left:settings-menu-pane-in :settings-menu :settings-menu-pane"});
        element(env, element7, context, "action", ["closeSettingsMenu"], {});
        inline(env, morph0, context, "gh-uploader", [], {"uploaded": "setCoverImage", "canceled": "clearCoverImage", "description": "Add post image", "image": get(env, context, "model.image"), "uploaderReference": get(env, context, "uploaderReference"), "tagName": "section"});
        inline(env, morph1, context, "gh-input", [], {"class": "post-setting-slug", "id": "url", "value": get(env, context, "slugValue"), "name": "post-setting-slug", "focus-out": "updateSlug", "selectOnClick": "true", "stopEnterKeyDownPropagation": "true"});
        inline(env, morph2, context, "gh-url-preview", [], {"slug": get(env, context, "slugValue"), "tagName": "p", "classNames": "description"});
        inline(env, morph3, context, "gh-input", [], {"class": "post-setting-date", "id": "post-setting-date", "value": get(env, context, "publishedAtValue"), "name": "post-setting-date", "focus-out": "setPublishedAt", "stopEnterKeyDownPropagation": "true"});
        block(env, morph4, context, "unless", [get(env, context, "session.user.isAuthor")], {}, child0, null);
        block(env, morph5, context, "gh-tab", [], {"tagName": "li", "classNames": "nav-list-item"}, child1, null);
        element(env, element12, context, "action", ["togglePage"], {"bubbles": "false"});
        inline(env, morph6, context, "input", [], {"type": "checkbox", "name": "static-page", "id": "static-page", "class": "post-setting-static-page", "checked": get(env, context, "model.page")});
        element(env, element13, context, "action", ["toggleFeatured"], {"bubbles": "false"});
        inline(env, morph7, context, "input", [], {"type": "checkbox", "name": "featured", "id": "featured", "class": "post-setting-featured", "checked": get(env, context, "model.featured")});
        element(env, element14, context, "bind-attr", [], {"class": "isViewingSubview:settings-menu-pane-in:settings-menu-pane-out-right :settings-menu :settings-menu-pane"});
        block(env, morph8, context, "gh-tab-pane", [], {}, child2, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","content-cover");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[2]); }
      var element15 = dom.childAt(fragment, [0]);
      var morph0 = dom.createMorphAt(fragment,1,2,contextualElement);
      element(env, element15, context, "action", ["closeSettingsMenu"], {});
      block(env, morph0, context, "gh-tabs-manager", [], {"selected": "showSubview", "id": "entry-controls", "class": "settings-menu-container"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/post-tags-input', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("           ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","tag");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var morph0 = dom.createMorphAt(element0,-1,-1);
        element(env, element0, context, "action", ["deleteTag", get(env, context, "tag")], {"target": get(env, context, "view")});
        content(env, morph0, context, "tag.name");
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("a");
          dom.setAttribute(el1,"href","javascript:void(0);");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),-1,-1);
          content(env, morph0, context, "view.suggestion.highlightedName");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        block(env, morph0, context, "view", [get(env, context, "view.suggestionView")], {"suggestion": get(env, context, "suggestion")}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","publish-bar-tags-icon");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("label");
      dom.setAttribute(el2,"class","tag-label icon-tag");
      dom.setAttribute(el2,"for","tags");
      dom.setAttribute(el2,"title","Tags");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","hidden");
      var el4 = dom.createTextNode("Tags");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","publish-bar-tags");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("div");
      dom.setAttribute(el2,"class","tags-wrapper tags");
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","publish-bar-tags-input");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("input");
      dom.setAttribute(el2,"type","hidden");
      dom.setAttribute(el2,"class","tags-holder");
      dom.setAttribute(el2,"id","tags-holder");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("ul");
      dom.setAttribute(el2,"class","suggestions dropdown-menu dropdown-triangle-bottom");
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline, element = hooks.element;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element1 = dom.childAt(fragment, [4]);
      var element2 = dom.childAt(element1, [4]);
      var morph0 = dom.createMorphAt(dom.childAt(fragment, [2, 1]),0,1);
      var morph1 = dom.createMorphAt(element1,2,3);
      var morph2 = dom.createMorphAt(element2,0,1);
      block(env, morph0, context, "each", [get(env, context, "controller.tags")], {"keyword": "tag"}, child0, null);
      inline(env, morph1, context, "view", [get(env, context, "view.tagInputView")], {"class": "tag-input js-tag-input", "id": "tags", "value": get(env, context, "newTagText")});
      element(env, element2, context, "bind-attr", [], {"style": get(env, context, "view.overlayStyles")});
      block(env, morph2, context, "each", [get(env, context, "suggestions")], {"keyword": "suggestion"}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/posts', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createElement("span");
        dom.setAttribute(el0,"class","hidden");
        var el1 = dom.createTextNode("New Post");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          var child0 = (function() {
            return {
              isHTMLBars: true,
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("                                    ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("span");
                dom.setAttribute(el1,"class","page");
                var el2 = dom.createTextNode("Page");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                return fragment;
              }
            };
          }());
          var child1 = (function() {
            return {
              isHTMLBars: true,
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("                                    ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("time");
                dom.setAttribute(el1,"class","date published");
                var el2 = dom.createTextNode("\n                                        Published ");
                dom.appendChild(el1, el2);
                var el2 = dom.createTextNode("\n                                    ");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, get = hooks.get, subexpr = hooks.subexpr, concat = hooks.concat, attribute = hooks.attribute, inline = hooks.inline;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var element0 = dom.childAt(fragment, [1]);
                var morph0 = dom.createMorphAt(element0,0,1);
                var attrMorph0 = dom.createAttrMorph(element0, 'datetime');
                attribute(env, attrMorph0, element0, "datetime", concat(env, [subexpr(env, context, "unbound", [get(env, context, "post.model.published_at")], {})]));
                inline(env, morph0, context, "gh-format-timeago", [get(env, context, "post.model.published_at")], {});
                return fragment;
              }
            };
          }());
          return {
            isHTMLBars: true,
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, block = hooks.block;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
              var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
              block(env, morph0, context, "if", [get(env, context, "post.model.page")], {}, child0, child1);
              return fragment;
            }
          };
        }());
        var child1 = (function() {
          return {
            isHTMLBars: true,
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1,"class","draft");
              var el2 = dom.createTextNode("Draft");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("h3");
            dom.setAttribute(el1,"class","entry-title");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n                    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("section");
            dom.setAttribute(el1,"class","entry-meta");
            var el2 = dom.createTextNode("\n                        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","avatar");
            var el3 = dom.createTextNode("\n                            ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("img");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n                        ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","author");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","status");
            var el3 = dom.createTextNode("\n");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("                        ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, content = hooks.content, get = hooks.get, element = hooks.element, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element1 = dom.childAt(fragment, [3]);
            var element2 = dom.childAt(element1, [1]);
            var element3 = dom.childAt(element2, [1]);
            var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),-1,-1);
            var morph1 = dom.createMorphAt(dom.childAt(element1, [3]),-1,-1);
            var morph2 = dom.createMorphAt(dom.childAt(element1, [5]),0,1);
            content(env, morph0, context, "post.model.title");
            element(env, element2, context, "bind-attr", [], {"style": get(env, context, "post.authorAvatarBackground")});
            element(env, element3, context, "bind-attr", [], {"src": "post.authorAvatar", "title": "post.authorName"});
            content(env, morph1, context, "post.authorName");
            block(env, morph2, context, "if", [get(env, context, "post.isPublished")], {}, child0, child1);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          block(env, morph0, context, "link-to", ["posts.post", get(env, context, "post")], {"class": "permalink", "alternateActive": get(env, context, "view.active"), "title": "Edit this post"}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("ol");
        dom.setAttribute(el1,"class","posts-list");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),0,1);
        block(env, morph0, context, "each", [get(env, context, "controller")], {"itemController": "posts/post", "itemView": "post-item-view", "itemTagName": "li", "keyword": "post"}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","page-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("button");
      dom.setAttribute(el2,"class","menu-button js-menu-button");
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","sr-only");
      var el4 = dom.createTextNode("Menu");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Content");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","page-content");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("header");
      dom.setAttribute(el3,"class","floatingheader");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("section");
      dom.setAttribute(el4,"class","content-filter");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("small");
      var el6 = dom.createTextNode("All Posts");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, block = hooks.block, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element4 = dom.childAt(fragment, [0, 1]);
      var element5 = dom.childAt(fragment, [2]);
      var element6 = dom.childAt(element5, [1]);
      var element7 = dom.childAt(element5, [3]);
      var morph0 = dom.createMorphAt(dom.childAt(element6, [1]),2,3);
      var morph1 = dom.createMorphAt(element6,2,3);
      var morph2 = dom.createMorphAt(element7,0,1);
      element(env, element4, context, "action", ["toggleGlobalMobileNav"], {});
      element(env, element6, context, "bind-attr", [], {"class": ":content-list :js-content-list postListFocused:keyboard-focused"});
      block(env, morph0, context, "link-to", ["editor.new"], {"class": "btn btn-green", "title": "New Post"}, child0, null);
      block(env, morph1, context, "view", ["paginated-scroll-box"], {"tagName": "section", "classNames": "content-list-content js-content-scrollbox"}, child1, null);
      element(env, element7, context, "bind-attr", [], {"class": ":content-preview :js-content-preview postContentFocused:keyboard-focused"});
      content(env, morph2, context, "outlet");
      return fragment;
    }
  };
}())); });

define('ghost/templates/posts/index', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createElement("button");
          dom.setAttribute(el0,"type","button");
          dom.setAttribute(el0,"class","btn btn-green btn-lg");
          dom.setAttribute(el0,"title","New Post");
          var el1 = dom.createTextNode("Write a new Post");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","no-posts");
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        var el3 = dom.createTextNode("You Haven't Written Any Posts Yet!");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),2,3);
        block(env, morph0, context, "link-to", ["editor.new"], {}, child0, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "if", [get(env, context, "noPosts")], {}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/posts/post', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Published");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Written");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child3 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        content(env, morph0, context, "model.author.name");
        return fragment;
      }
    };
  }());
  var child4 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        content(env, morph0, context, "model.author.email");
        return fragment;
      }
    };
  }());
  var child5 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode(" Edit");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child6 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","wrapper");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),-1,-1);
        var morph1 = dom.createMorphAt(element0,2,3);
        content(env, morph0, context, "model.title");
        inline(env, morph1, context, "gh-format-html", [get(env, context, "model.html")], {});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","post-preview-header clearfix");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Preview");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("button");
      dom.setAttribute(el2,"type","button");
      dom.setAttribute(el2,"title","Feature this post");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","hidden");
      var el4 = dom.createTextNode("Star");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("small");
      dom.setAttribute(el2,"class","post-published-by");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","status");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","normal");
      var el4 = dom.createTextNode("by");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","author");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","post-controls");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[2]); }
      var element1 = dom.childAt(fragment, [0]);
      var element2 = dom.childAt(element1, [4]);
      var element3 = dom.childAt(element1, [6]);
      var morph0 = dom.createMorphAt(element1,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element3, [1]),-1,-1);
      var morph2 = dom.createMorphAt(dom.childAt(element3, [5]),-1,-1);
      var morph3 = dom.createMorphAt(dom.childAt(element1, [8]),0,1);
      var morph4 = dom.createMorphAt(fragment,1,2,contextualElement);
      block(env, morph0, context, "link-to", ["posts"], {"tagName": "button", "class": "btn btn-default btn-back"}, child0, null);
      element(env, element2, context, "bind-attr", [], {"class": "model.featured:featured:unfeatured"});
      element(env, element2, context, "action", ["toggleFeatured"], {});
      block(env, morph1, context, "if", [get(env, context, "isPublished")], {}, child1, child2);
      block(env, morph2, context, "if", [get(env, context, "model.author.name")], {}, child3, child4);
      block(env, morph3, context, "link-to", ["editor.edit", get(env, context, "this")], {"class": "btn btn-default post-edit"}, child5, null);
      block(env, morph4, context, "view", ["content-preview-content-view"], {"tagName": "section"}, child6, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/reset', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","reset-box js-reset-box fade-in");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","reset");
      dom.setAttribute(el2,"class","reset-form");
      dom.setAttribute(el2,"method","post");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","password-wrap");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","password-wrap");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"class","btn btn-blue");
      dom.setAttribute(el3,"type","submit");
      var el4 = dom.createTextNode("Reset Password");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(element0, [5]);
      var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),0,1);
      element(env, element0, context, "action", ["submit"], {"on": "submit"});
      inline(env, morph0, context, "input", [], {"value": get(env, context, "newPassword"), "class": "password", "type": "password", "placeholder": "Password", "name": "newpassword", "autofocus": "autofocus"});
      inline(env, morph1, context, "input", [], {"value": get(env, context, "ne2Password"), "class": "password", "type": "password", "placeholder": "Confirm Password", "name": "ne2password"});
      element(env, element1, context, "bind-attr", [], {"disabled": "submitting"});
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.general", "title": "General", "classNames": "settings-nav-general icon-settings"});
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.users", "title": "Users", "classNames": "settings-nav-users icon-users"});
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.tags", "title": "Tags", "classNames": "settings-nav-tags icon-tag"});
        return fragment;
      }
    };
  }());
  var child3 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.navigation", "title": "Navigation", "classNames": "settings-nav-navigation icon-compass"});
        return fragment;
      }
    };
  }());
  var child4 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.code-injection", "title": "Code Injection", "classNames": "settings-nav-code icon-code"});
        return fragment;
      }
    };
  }());
  var child5 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.labs", "title": "Labs", "classNames": "settings-nav-labs icon-atom"});
        return fragment;
      }
    };
  }());
  var child6 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-activating-list-item", [], {"route": "settings.about", "title": "About", "classNames": "settings-nav-about icon-pacman"});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","page-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("button");
      dom.setAttribute(el2,"class","menu-button js-menu-button");
      var el3 = dom.createElement("span");
      dom.setAttribute(el3,"class","sr-only");
      var el4 = dom.createTextNode("Menu");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Settings");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","page-content");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("nav");
      dom.setAttribute(el2,"class","settings-nav js-settings-menu");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("ul");
      var el4 = dom.createTextNode("\n\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, get = hooks.get, block = hooks.block, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(fragment, [2]);
      var element2 = dom.childAt(element1, [1, 1]);
      var morph0 = dom.createMorphAt(element2,0,1);
      var morph1 = dom.createMorphAt(element2,1,2);
      var morph2 = dom.createMorphAt(element2,2,3);
      var morph3 = dom.createMorphAt(element2,3,4);
      var morph4 = dom.createMorphAt(element2,4,5);
      var morph5 = dom.createMorphAt(element2,5,6);
      var morph6 = dom.createMorphAt(element2,6,7);
      var morph7 = dom.createMorphAt(element1,2,3);
      element(env, element0, context, "action", ["toggleGlobalMobileNav"], {});
      block(env, morph0, context, "if", [get(env, context, "showGeneral")], {}, child0, null);
      block(env, morph1, context, "if", [get(env, context, "showUsers")], {}, child1, null);
      block(env, morph2, context, "if", [get(env, context, "showTags")], {}, child2, null);
      block(env, morph3, context, "if", [get(env, context, "showNavigation")], {}, child3, null);
      block(env, morph4, context, "if", [get(env, context, "showCodeInjection")], {}, child4, null);
      block(env, morph5, context, "if", [get(env, context, "showLabs")], {}, child5, null);
      block(env, morph6, context, "if", [get(env, context, "showAbout")], {}, child6, null);
      content(env, morph7, context, "outlet");
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/about', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        content(env, morph0, context, "model.mail");
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Native");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("About");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-about");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","about-ghost-intro");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("h1");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("span");
      dom.setAttribute(el4,"class","ghost_logo");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("span");
      dom.setAttribute(el5,"class","hidden");
      var el6 = dom.createTextNode("Ghost");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("span");
      dom.setAttribute(el4,"class","version blue");
      var el5 = dom.createTextNode("v");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("p");
      var el4 = dom.createTextNode("A free, open, simple publishing platform");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","about-environment-help clearfix");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","about-environment");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("dl");
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dt");
      var el7 = dom.createTextNode("Version:");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dd");
      dom.setAttribute(el6,"class","about-environment-detail");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dt");
      var el7 = dom.createTextNode("Environment:");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dd");
      dom.setAttribute(el6,"class","about-environment-detail");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dt");
      var el7 = dom.createTextNode("Database:");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dd");
      dom.setAttribute(el6,"class","about-environment-detail about-environment-database");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dt");
      var el7 = dom.createTextNode("Mail:");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("dd");
      dom.setAttribute(el6,"class","about-environment-detail");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","about-help");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("a");
      dom.setAttribute(el5,"href","http://support.ghost.org");
      dom.setAttribute(el5,"class","btn");
      var el6 = dom.createTextNode("User Documentation");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("a");
      dom.setAttribute(el5,"href","https://ghost.org/forum/");
      dom.setAttribute(el5,"class","btn");
      var el6 = dom.createTextNode("Get Help With Ghost");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","about-credits");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("h1");
      var el4 = dom.createTextNode("The People Who Made it Possible");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("ul");
      dom.setAttribute(el3,"class","top-contributors clearfix");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("p");
      dom.setAttribute(el3,"class","about-contributors-info");
      var el4 = dom.createTextNode("Ghost is built by an incredible group of contributors from all over the world. Here are just a few of the people who helped create the version you’re using right now.");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("a");
      dom.setAttribute(el3,"href","https://ghost.org/about/contribute/");
      dom.setAttribute(el3,"class","about-get-involved btn-blue btn-lg btn");
      var el4 = dom.createTextNode("Find out how you can get involved");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("p");
      dom.setAttribute(el3,"class","about-copyright");
      var el4 = dom.createTextNode("\n            Copyright 2013 - 2015 Ghost Foundation, released under the ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("a");
      dom.setAttribute(el4,"href","https://github.com/TryGhost/Ghost/blob/master/LICENSE");
      var el5 = dom.createTextNode("MIT license");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode(".\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("br");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("a");
      dom.setAttribute(el4,"href","https://ghost.org/");
      var el5 = dom.createTextNode("Ghost");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode(" is a trademark of the ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("a");
      dom.setAttribute(el4,"href","https://ghost.org/about/");
      var el5 = dom.createTextNode("Ghost Foundation");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode(".\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, content = hooks.content, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [2]);
      var element1 = dom.childAt(element0, [1]);
      var element2 = dom.childAt(element1, [5, 1, 1]);
      var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element1, [1, 3]),0,-1);
      var morph2 = dom.createMorphAt(dom.childAt(element2, [3]),-1,-1);
      var morph3 = dom.createMorphAt(dom.childAt(element2, [7]),-1,-1);
      var morph4 = dom.createMorphAt(dom.childAt(element2, [11]),-1,-1);
      var morph5 = dom.createMorphAt(dom.childAt(element2, [15]),-1,-1);
      var morph6 = dom.createMorphAt(dom.childAt(element0, [3, 3]),0,1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      content(env, morph1, context, "model.version");
      content(env, morph2, context, "model.version");
      content(env, morph3, context, "model.environment");
      content(env, morph4, context, "model.database");
      block(env, morph5, context, "if", [get(env, context, "model.mail")], {}, child1, child2);
      inline(env, morph6, context, "partial", ["contributors"], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/apps', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" - ");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,2]); }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          var morph1 = dom.createMorphAt(fragment,1,2,contextualElement);
          content(env, morph0, context, "appController.model.package.name");
          content(env, morph1, context, "appController.model.package.version");
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode(" - package.json missing :(");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          content(env, morph0, context, "appController.model.name");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("tr");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("td");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("td");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3,"type","button");
        var el4 = dom.createTextNode("\n                    ");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n                ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        var element1 = dom.childAt(element0, [3, 1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,1);
        var morph1 = dom.createMorphAt(element1,0,1);
        block(env, morph0, context, "if", [get(env, context, "appController.model.package")], {}, child0, child1);
        element(env, element1, context, "action", [get(env, context, "toggleApp"), get(env, context, "appController")], {});
        element(env, element1, context, "bind-attr", [], {"class": ":btn :js-button-active activeClass:btn-red inactiveClass:btn-green activeClass:js-button-deactivate"});
        content(env, morph1, context, "appController.buttonText");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","title");
      var el3 = dom.createTextNode("Apps");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-apps");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("table");
      dom.setAttribute(el2,"class","js-apps");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("thead");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("th");
      var el5 = dom.createTextNode("App name");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("th");
      var el5 = dom.createTextNode("Status");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("tbody");
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),0,1);
      var morph1 = dom.createMorphAt(dom.childAt(fragment, [2, 1, 3]),0,1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      block(env, morph1, context, "each", [get(env, context, "model")], {"itemController": "settings/app", "keyword": "appController"}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/code-injection', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Code Injection");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","page-actions");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"type","button");
      dom.setAttribute(el3,"class","btn btn-blue");
      var el4 = dom.createTextNode("Save");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-code");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-code");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("\n                    Ghost allows you to inject code into the top and bottom of your template files without editing them. This allows for quick modifications to insert useful things like tracking codes and meta data.\n                ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","ghost-head");
      var el6 = dom.createTextNode("Blog Header");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Code here will be injected to the {{ghost_head}} helper at the top of your page");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","ghost-foot");
      var el6 = dom.createTextNode("Blog Footer");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Code here will be injected to the {{ghost_foot}} helper at the bottom of your page");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0]);
      var element1 = dom.childAt(element0, [4, 1]);
      var element2 = dom.childAt(fragment, [2, 1, 1]);
      var morph0 = dom.createMorphAt(element0,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element2, [3]),4,5);
      var morph2 = dom.createMorphAt(dom.childAt(element2, [5]),4,5);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      element(env, element1, context, "action", ["save"], {});
      inline(env, morph1, context, "textarea", [], {"id": "ghost-head", "name": "codeInjection[ghost_head]", "type": "text", "value": get(env, context, "model.ghost_head")});
      inline(env, morph2, context, "textarea", [], {"id": "ghost-foot", "name": "codeInjection[ghost_foot]", "type": "text", "value": get(env, context, "model.ghost_foot")});
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/general', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","js-modal-logo");
        var el2 = dom.createElement("img");
        dom.setAttribute(el2,"id","blog-logo");
        dom.setAttribute(el2,"alt","logo");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element4 = dom.childAt(fragment, [1]);
        var element5 = dom.childAt(element4, [0]);
        element(env, element4, context, "action", ["openModal", "upload", get(env, context, "this"), "logo"], {});
        element(env, element5, context, "bind-attr", [], {"src": get(env, context, "model.logo")});
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","btn btn-green js-modal-logo");
        var el2 = dom.createTextNode("Upload Image");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element3 = dom.childAt(fragment, [1]);
        element(env, element3, context, "action", ["openModal", "upload", get(env, context, "this"), "logo"], {});
        return fragment;
      }
    };
  }());
  var child3 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","js-modal-cover");
        var el2 = dom.createElement("img");
        dom.setAttribute(el2,"id","blog-cover");
        dom.setAttribute(el2,"alt","cover photo");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [1]);
        var element2 = dom.childAt(element1, [0]);
        element(env, element1, context, "action", ["openModal", "upload", get(env, context, "this"), "cover"], {});
        element(env, element2, context, "bind-attr", [], {"src": get(env, context, "model.cover")});
        return fragment;
      }
    };
  }());
  var child4 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("                ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","btn btn-green js-modal-cover");
        var el2 = dom.createTextNode("Upload Image");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        element(env, element0, context, "action", ["openModal", "upload", get(env, context, "this"), "cover"], {});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("General");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","page-actions");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"type","button");
      dom.setAttribute(el3,"class","btn btn-blue");
      var el4 = dom.createTextNode("Save");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-general");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-general");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","blog-title");
      var el6 = dom.createTextNode("Blog Title");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("The name of your blog");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group description-container");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","blog-description");
      var el6 = dom.createTextNode("Blog Description");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("\n                    Describe what your blog is about\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","form-group");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("label");
      dom.setAttribute(el4,"for","blog-logo");
      var el5 = dom.createTextNode("Blog Logo");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("p");
      var el5 = dom.createTextNode("Display a sexy logo for your publication");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","form-group");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("label");
      dom.setAttribute(el4,"for","blog-cover");
      var el5 = dom.createTextNode("Blog Cover");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("p");
      var el5 = dom.createTextNode("Display a cover image on your site");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","email-address");
      var el6 = dom.createTextNode("Email Address");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Address to use for admin notifications");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","postsPerPage");
      var el6 = dom.createTextNode("Posts per page");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("How many posts should be displayed on each page");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group for-checkbox");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","permalinks");
      var el6 = dom.createTextNode("Dated Permalinks");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"class","checkbox");
      dom.setAttribute(el5,"for","permalinks");
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("span");
      dom.setAttribute(el6,"class","input-toggle-component");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("p");
      var el7 = dom.createTextNode("Include the date in your post URLs");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group for-select");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","activeTheme");
      var el6 = dom.createTextNode("Theme");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("span");
      dom.setAttribute(el5,"class","gh-select");
      dom.setAttribute(el5,"tabindex","0");
      var el6 = dom.createTextNode("\n                   ");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n               ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Select a theme for your blog");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element6 = dom.childAt(fragment, [0]);
      var element7 = dom.childAt(element6, [4, 1]);
      var element8 = dom.childAt(fragment, [2, 1]);
      var element9 = dom.childAt(element8, [1]);
      var element10 = dom.childAt(element9, [3]);
      var element11 = dom.childAt(element8, [7]);
      var element12 = dom.childAt(element11, [7, 3]);
      var morph0 = dom.createMorphAt(element6,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element9, [1]),2,3);
      var morph2 = dom.createMorphAt(element10,2,3);
      var morph3 = dom.createMorphAt(dom.childAt(element10, [4]),0,1);
      var morph4 = dom.createMorphAt(dom.childAt(element8, [3]),2,3);
      var morph5 = dom.createMorphAt(dom.childAt(element8, [5]),2,3);
      var morph6 = dom.createMorphAt(dom.childAt(element11, [1]),2,3);
      var morph7 = dom.createMorphAt(dom.childAt(element11, [3]),2,3);
      var morph8 = dom.createMorphAt(dom.childAt(element11, [5, 3]),0,1);
      var morph9 = dom.createMorphAt(element12,0,1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      element(env, element7, context, "action", ["save"], {});
      inline(env, morph1, context, "input", [], {"id": "blog-title", "name": "general[title]", "type": "text", "value": get(env, context, "model.title")});
      inline(env, morph2, context, "textarea", [], {"id": "blog-description", "name": "general[description]", "value": get(env, context, "model.description")});
      inline(env, morph3, context, "gh-count-characters", [get(env, context, "model.description")], {});
      block(env, morph4, context, "if", [get(env, context, "model.logo")], {}, child1, child2);
      block(env, morph5, context, "if", [get(env, context, "model.cover")], {}, child3, child4);
      inline(env, morph6, context, "input", [], {"id": "email-address", "name": "general[email-address]", "type": "email", "value": get(env, context, "model.email"), "autocapitalize": "off", "autocorrect": "off"});
      inline(env, morph7, context, "input", [], {"id": "postsPerPage", "name": "general[postsPerPage]", "focus-out": "checkPostsPerPage", "value": get(env, context, "model.postsPerPage"), "min": "1", "max": "1000", "type": "number", "pattern": "[0-9]*"});
      inline(env, morph8, context, "input", [], {"id": "permalinks", "name": "general[permalinks]", "type": "checkbox", "checked": get(env, context, "isDatedPermalinks")});
      element(env, element12, context, "bind-attr", [], {"data-select-text": get(env, context, "selectedTheme.label")});
      inline(env, morph9, context, "view", ["select"], {"id": "activeTheme", "name": "general[activeTheme]", "content": get(env, context, "themes"), "optionValuePath": "content.name", "optionLabelPath": "content.label", "value": get(env, context, "model.activeTheme"), "selection": get(env, context, "selectedTheme")});
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/labs', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("fieldset");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","form-group");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        var el4 = dom.createTextNode("Import");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("p");
        var el4 = dom.createTextNode("Import from another Ghost installation. If you import a user, this will replace the current user & log you out.");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline, get = hooks.get;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1, 1]);
        var morph0 = dom.createMorphAt(element0,2,3);
        var morph1 = dom.createMorphAt(element0,3,4);
        inline(env, morph0, context, "partial", ["import-errors"], {});
        inline(env, morph1, context, "gh-file-upload", [], {"id": "importfile", "uploadButtonText": get(env, context, "uploadButtonText")});
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","form-group for-checkbox");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("label");
        dom.setAttribute(el2,"for","labs-codeInjectionUI");
        var el3 = dom.createTextNode("Code Injection");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("label");
        dom.setAttribute(el2,"class","check box");
        dom.setAttribute(el2,"for","labs-codeInjectionUI");
        var el3 = dom.createTextNode("\n                    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","input-toggle-component");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("p");
        var el4 = dom.createTextNode("Enable the code injection interface");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("A settings screen which enables you to add code into your theme (work in progress)");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [1, 3]),0,1);
        inline(env, morph0, context, "input", [], {"id": "labs-codeInjectionUI", "name": "labs[codeInjectionUI]", "type": "checkbox", "checked": get(env, context, "useCodeInjectionUI")});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Labs");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-debug");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-export");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      var el6 = dom.createTextNode("Export");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-blue");
      var el6 = dom.createTextNode("Export");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Export the blog settings and data.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-resetdb");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      var el6 = dom.createTextNode("Delete all Content");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-red js-delete");
      var el6 = dom.createTextNode("Delete");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Delete all posts and tags from the database.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-testmail");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      var el6 = dom.createTextNode("Send a test email");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"id","sendtestmail");
      dom.setAttribute(el5,"class","btn btn-blue");
      var el6 = dom.createTextNode("Send");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Sends a test email to your address.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("hr");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element1 = dom.childAt(fragment, [2]);
      var element2 = dom.childAt(element1, [1, 1, 1, 3]);
      var element3 = dom.childAt(element1, [4, 1, 1, 3]);
      var element4 = dom.childAt(element1, [6, 1, 1, 3]);
      var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),0,1);
      var morph1 = dom.createMorphAt(element1,2,3);
      var morph2 = dom.createMorphAt(dom.childAt(element1, [10, 1]),0,1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      element(env, element2, context, "action", ["exportData"], {});
      block(env, morph1, context, "gh-form", [], {"id": "settings-import", "enctype": "multipart/form-data"}, child1, null);
      element(env, element3, context, "action", ["openModal", "deleteAll"], {});
      element(env, element4, context, "action", ["sendTestEmail"], {});
      block(env, morph2, context, "unless", [get(env, context, "codeUIFlag")], {}, child2, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/navigation', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        inline(env, morph0, context, "gh-navitem", [], {"navItem": get(env, context, "navItem"), "baseUrl": get(env, context, "blogUrl"), "addItem": "addItem", "deleteItem": "deleteItem", "updateUrl": "updateUrl"});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Navigation");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","page-actions");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"type","button");
      dom.setAttribute(el3,"class","btn btn-blue");
      var el4 = dom.createTextNode("Save");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-navigation");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","settings-navigation");
      dom.setAttribute(el2,"class","js-settings-navigation");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0]);
      var element1 = dom.childAt(element0, [4, 1]);
      var morph0 = dom.createMorphAt(element0,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(fragment, [2, 1]),0,1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      element(env, element1, context, "action", ["save"], {});
      block(env, morph1, context, "each", [get(env, context, "navigationItems")], {"keyword": "navItem"}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/tags', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Back");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","settings-tag");
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"class","tag-edit-button");
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","tag-title");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","label label-default");
        var el4 = dom.createTextNode("/");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("p");
        dom.setAttribute(el3,"class","tag-description");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n                ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","tags-count");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1, 1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),-1,-1);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),0,-1);
        var morph2 = dom.createMorphAt(dom.childAt(element0, [5]),-1,-1);
        var morph3 = dom.createMorphAt(dom.childAt(element0, [7]),-1,-1);
        element(env, element0, context, "action", ["editTag", get(env, context, "tag")], {});
        content(env, morph0, context, "tag.name");
        content(env, morph1, context, "tag.slug");
        content(env, morph2, context, "tag.description");
        content(env, morph3, context, "tag.post_count");
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-view-header");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      var el3 = dom.createTextNode("Tags");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","page-actions");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"type","button");
      dom.setAttribute(el3,"class","btn btn-green");
      var el4 = dom.createTextNode("New Tag");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","content settings-tags");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block, element = hooks.element, get = hooks.get;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element1 = dom.childAt(fragment, [0]);
      var element2 = dom.childAt(element1, [4, 1]);
      var morph0 = dom.createMorphAt(element1,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(fragment, [2]),0,-1);
      block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
      element(env, element2, context, "action", ["newTag"], {});
      block(env, morph1, context, "each", [get(env, context, "tags")], {"keyword": "tag"}, child1, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/tags/settings-menu', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1,"type","button");
          var el2 = dom.createTextNode("\n                            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("b");
          var el3 = dom.createTextNode("Meta Data");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          var el3 = dom.createTextNode("Extra content for SEO and social media.");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1,"type","button");
          dom.setAttribute(el1,"class","btn btn-link btn-sm tag-delete-button icon-trash");
          var el2 = dom.createTextNode("Delete Tag");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, element = hooks.element;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element5 = dom.childAt(fragment, [1]);
          element(env, element5, context, "action", ["openModal", "delete-tag", get(env, context, "activeTag")], {});
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("            ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","settings-menu-header subview");
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2,"class","back icon-chevron-left settings-menu-header-action");
          var el3 = dom.createElement("span");
          dom.setAttribute(el3,"class","hidden");
          var el4 = dom.createTextNode("Back");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Meta Data");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n\n            ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","settings-menu-content");
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("form");
          var el3 = dom.createTextNode("\n                ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          dom.setAttribute(el4,"for","meta-title");
          var el5 = dom.createTextNode("Meta Title");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("p");
          var el5 = dom.createTextNode("Recommended: ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("b");
          var el6 = dom.createTextNode("70");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode(" characters. You’ve used ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n                ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          dom.setAttribute(el4,"for","meta-description");
          var el5 = dom.createTextNode("Meta Description");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("p");
          var el5 = dom.createTextNode("Recommended: ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("b");
          var el6 = dom.createTextNode("156");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode(" characters. You’ve used ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n                ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","form-group");
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          var el5 = dom.createTextNode("Search Engine Result Preview");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                    ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("div");
          dom.setAttribute(el4,"class","seo-preview");
          var el5 = dom.createTextNode("\n                        ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-title");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                        ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-link");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                        ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("div");
          dom.setAttribute(el5,"class","seo-preview-description");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n                    ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n                ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n                ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1, 1]);
          var element1 = dom.childAt(fragment, [3, 1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [3]);
          var element4 = dom.childAt(element1, [5, 3]);
          var morph0 = dom.createMorphAt(element2,2,3);
          var morph1 = dom.createMorphAt(dom.childAt(element2, [4]),2,-1);
          var morph2 = dom.createMorphAt(element3,2,3);
          var morph3 = dom.createMorphAt(dom.childAt(element3, [4]),2,-1);
          var morph4 = dom.createMorphAt(dom.childAt(element4, [1]),-1,-1);
          var morph5 = dom.createMorphAt(dom.childAt(element4, [3]),-1,-1);
          var morph6 = dom.createMorphAt(dom.childAt(element4, [5]),-1,-1);
          element(env, element0, context, "action", ["closeSubview"], {});
          inline(env, morph0, context, "gh-input", [], {"type": "text", "value": get(env, context, "activeTagMetaTitleScratch"), "focus-out": "saveActiveTagMetaTitle"});
          inline(env, morph1, context, "gh-count-down-characters", [get(env, context, "activeTagMetaTitleScratch"), 70], {});
          inline(env, morph2, context, "gh-textarea", [], {"value": get(env, context, "activeTagMetaDescriptionScratch"), "focus-out": "saveActiveTagMetaDescription"});
          inline(env, morph3, context, "gh-count-down-characters", [get(env, context, "activeTagMetaDescriptionScratch"), 156], {});
          content(env, morph4, context, "seoTitle");
          content(env, morph5, context, "seoURL");
          content(env, morph6, context, "seoDescription");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","settings-menu-header");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h4");
        var el4 = dom.createTextNode("Tag Settings");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3,"class","close icon-x settings-menu-header-action");
        var el4 = dom.createTextNode("\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","hidden");
        var el5 = dom.createTextNode("Close");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","settings-menu-content");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("form");
        var el4 = dom.createTextNode("\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","form-group");
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("label");
        var el6 = dom.createTextNode("Name");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","form-group");
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("label");
        var el6 = dom.createTextNode("URL");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","form-group");
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("label");
        var el6 = dom.createTextNode("Description");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                    ");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n                ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","nav-list nav-list-block");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("                ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element6 = dom.childAt(fragment, [1]);
        var element7 = dom.childAt(element6, [1, 3]);
        var element8 = dom.childAt(element6, [3]);
        var element9 = dom.childAt(element8, [2]);
        var element10 = dom.childAt(element9, [3]);
        var element11 = dom.childAt(fragment, [3]);
        var morph0 = dom.createMorphAt(element8,0,1);
        var morph1 = dom.createMorphAt(dom.childAt(element9, [1]),2,3);
        var morph2 = dom.createMorphAt(element10,2,3);
        var morph3 = dom.createMorphAt(element10,3,4);
        var morph4 = dom.createMorphAt(dom.childAt(element9, [5]),2,3);
        var morph5 = dom.createMorphAt(dom.childAt(element9, [7]),0,1);
        var morph6 = dom.createMorphAt(element9,8,9);
        var morph7 = dom.createMorphAt(element11,0,1);
        element(env, element6, context, "bind-attr", [], {"class": "isViewingSubview:settings-menu-pane-out-left:settings-menu-pane-in :settings-menu :settings-menu-pane"});
        element(env, element7, context, "action", ["closeSettingsMenu"], {});
        inline(env, morph0, context, "gh-uploader", [], {"uploaded": "setCoverImage", "canceled": "clearCoverImage", "description": "Add tag image", "image": get(env, context, "activeTag.image"), "uploaderReference": get(env, context, "uploaderReference"), "tagName": "section"});
        inline(env, morph1, context, "gh-input", [], {"type": "text", "value": get(env, context, "activeTagNameScratch"), "focus-out": "saveActiveTagName"});
        inline(env, morph2, context, "gh-input", [], {"type": "text", "value": get(env, context, "activeTagSlugScratch"), "focus-out": "saveActiveTagSlug"});
        inline(env, morph3, context, "gh-url-preview", [], {"prefix": "tag", "slug": get(env, context, "activeTagSlugScratch"), "tagName": "p", "classNames": "description"});
        inline(env, morph4, context, "gh-textarea", [], {"value": get(env, context, "activeTagDescriptionScratch"), "focus-out": "saveActiveTagDescription"});
        block(env, morph5, context, "gh-tab", [], {"tagName": "li", "classNames": "nav-list-item"}, child0, null);
        block(env, morph6, context, "unless", [get(env, context, "activeTag.isNew")], {}, child1, null);
        element(env, element11, context, "bind-attr", [], {"class": "isViewingSubview:settings-menu-pane-in:settings-menu-pane-out-right :settings-menu :settings-menu-pane"});
        block(env, morph7, context, "gh-tab-pane", [], {}, child2, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","content-cover");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[2]); }
      var element12 = dom.childAt(fragment, [0]);
      var morph0 = dom.createMorphAt(fragment,1,2,contextualElement);
      element(env, element12, context, "action", ["closeSettingsMenu"], {});
      block(env, morph0, context, "gh-tabs-manager", [], {"selected": "showSubview", "class": "settings-menu-container"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/users', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, content = hooks.content;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      content(env, morph0, context, "outlet");
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/users/index', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createTextNode("Back");
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("            ");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          block(env, morph0, context, "link-to", ["content"], {"class": "btn btn-default btn-back"}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createTextNode("Back");
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("            ");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          block(env, morph0, context, "link-to", ["settings"], {"class": "btn btn-default btn-back"}, child0, null);
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1,"class","red");
              var el2 = dom.createTextNode("Invitation not sent - please try again");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              return fragment;
            }
          };
        }());
        var child1 = (function() {
          return {
            isHTMLBars: true,
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1,"class","description");
              var el2 = dom.createTextNode("Invitation sent: ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),0,-1);
              content(env, morph0, context, "user.model.created_at");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","user-list-item");
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","user-list-item-icon icon-mail");
            var el3 = dom.createTextNode("ic");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","user-list-item-body");
            var el3 = dom.createTextNode("\n                        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("span");
            dom.setAttribute(el3,"class","name");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("br");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("                    ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("aside");
            dom.setAttribute(el2,"class","user-list-item-aside");
            var el3 = dom.createTextNode("\n                        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("a");
            dom.setAttribute(el3,"class","user-list-action");
            dom.setAttribute(el3,"href","#");
            var el4 = dom.createTextNode("Revoke");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n                        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("a");
            dom.setAttribute(el3,"class","user-list-action");
            dom.setAttribute(el3,"href","#");
            var el4 = dom.createTextNode("Resend");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n                    ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, content = hooks.content, get = hooks.get, block = hooks.block, element = hooks.element;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element3 = dom.childAt(fragment, [1]);
            var element4 = dom.childAt(element3, [3]);
            var element5 = dom.childAt(element3, [5]);
            var element6 = dom.childAt(element5, [1]);
            var element7 = dom.childAt(element5, [3]);
            var morph0 = dom.createMorphAt(dom.childAt(element4, [1]),-1,-1);
            var morph1 = dom.createMorphAt(element4,3,4);
            content(env, morph0, context, "user.email");
            block(env, morph1, context, "if", [get(env, context, "user.model.pending")], {}, child0, child1);
            element(env, element6, context, "action", ["revoke"], {});
            element(env, element7, context, "action", ["resend"], {});
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("\n        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("section");
          dom.setAttribute(el1,"class","user-list invited-users");
          var el2 = dom.createTextNode("\n\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          dom.setAttribute(el2,"class","user-list-title");
          var el3 = dom.createTextNode("Invited users");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),2,3);
          block(env, morph0, context, "each", [get(env, context, "invitedUsers")], {"itemController": "settings/users/user", "keyword": "user"}, child0, null);
          return fragment;
        }
      };
    }());
    var child3 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          var child0 = (function() {
            return {
              isHTMLBars: true,
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("                            ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("span");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, get = hooks.get, subexpr = hooks.subexpr, concat = hooks.concat, attribute = hooks.attribute, content = hooks.content;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var element0 = dom.childAt(fragment, [1]);
                var morph0 = dom.createMorphAt(element0,-1,-1);
                var attrMorph0 = dom.createAttrMorph(element0, 'class');
                attribute(env, attrMorph0, element0, "class", concat(env, ["role-label ", subexpr(env, context, "unbound", [get(env, context, "role.lowerCaseName")], {})]));
                content(env, morph0, context, "role.name");
                return fragment;
              }
            };
          }());
          return {
            isHTMLBars: true,
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, block = hooks.block;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
              var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
              block(env, morph0, context, "each", [get(env, context, "user.model.roles")], {"keyword": "role"}, child0, null);
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("span");
            dom.setAttribute(el1,"class","user-list-item-figure");
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","hidden");
            var el3 = dom.createTextNode("Photo of ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n\n                ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","user-list-item-body");
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","name");
            var el3 = dom.createTextNode("\n                        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n                    ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("br");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            dom.setAttribute(el2,"class","description");
            var el3 = dom.createTextNode("Last seen: ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n                ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("aside");
            dom.setAttribute(el1,"class","user-list-item-aside");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("                ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, get = hooks.get, element = hooks.element, inline = hooks.inline, content = hooks.content, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element1 = dom.childAt(fragment, [1]);
            var element2 = dom.childAt(fragment, [3]);
            var morph0 = dom.createMorphAt(dom.childAt(element1, [1]),0,-1);
            var morph1 = dom.createMorphAt(dom.childAt(element2, [1]),0,1);
            var morph2 = dom.createMorphAt(dom.childAt(element2, [5]),0,-1);
            var morph3 = dom.createMorphAt(dom.childAt(fragment, [5]),0,1);
            element(env, element1, context, "bind-attr", [], {"style": get(env, context, "user.image")});
            inline(env, morph0, context, "unbound", [get(env, context, "user.model.name")], {});
            content(env, morph1, context, "user.model.name");
            inline(env, morph2, context, "unbound", [get(env, context, "user.last_login")], {});
            block(env, morph3, context, "unless", [get(env, context, "user.model.isAuthor")], {}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          block(env, morph0, context, "link-to", ["settings.users.user", get(env, context, "user")], {"class": "user-list-item"}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("header");
        dom.setAttribute(el1,"class","settings-view-header user-list-header");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        dom.setAttribute(el2,"class","page-title");
        var el3 = dom.createTextNode("Users");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("section");
        dom.setAttribute(el2,"class","page-actions");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3,"class","btn btn-green");
        var el4 = dom.createTextNode("New User");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("section");
        dom.setAttribute(el1,"class","content settings-users");
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("section");
        dom.setAttribute(el2,"class","user-list active-users");
        var el3 = dom.createTextNode("\n\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h4");
        dom.setAttribute(el3,"class","user-list-title");
        var el4 = dom.createTextNode("Active users");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element8 = dom.childAt(fragment, [1]);
        var element9 = dom.childAt(element8, [4, 1]);
        var element10 = dom.childAt(fragment, [3]);
        var morph0 = dom.createMorphAt(element8,0,1);
        var morph1 = dom.createMorphAt(element10,0,1);
        var morph2 = dom.createMorphAt(dom.childAt(element10, [2]),2,3);
        block(env, morph0, context, "if", [get(env, context, "session.user.isEditor")], {}, child0, child1);
        element(env, element9, context, "action", ["openModal", "invite-new-user"], {});
        block(env, morph1, context, "if", [get(env, context, "invitedUsers")], {}, child2, null);
        block(env, morph2, context, "each", [get(env, context, "activeUsers")], {"itemController": "settings/users/user", "keyword": "user"}, child3, null);
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      if (this.cachedFragment) { dom.repairClonedNode(fragment,[0,1]); }
      var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
      block(env, morph0, context, "view", ["settings/users/users-list-view"], {"class": "users-list-wrapper js-users-list-view"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/settings/users/user', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("i");
          dom.setAttribute(el1,"class","icon-chevron-left");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("Users");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("        ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
        block(env, morph0, context, "link-to", ["settings.users"], {"class": "btn btn-default btn-back", "tagName": "button"}, child0, null);
        return fragment;
      }
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("i");
          dom.setAttribute(el1,"class","icon-settings");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n                    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1,"class","hidden");
          var el2 = dom.createTextNode("User Settings");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,1,contextualElement);
          inline(env, morph0, context, "partial", ["user-actions-menu"], {});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","dropdown");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [1]);
        if (this.cachedFragment) { dom.repairClonedNode(element0,[1]); }
        var morph0 = dom.createMorphAt(element0,0,1);
        var morph1 = dom.createMorphAt(element0,1,2);
        block(env, morph0, context, "gh-dropdown-button", [], {"dropdownName": "user-actions-menu", "classNames": "btn btn-default only-has-icon user-actions-cog", "title": "User Actions"}, child0, null);
        block(env, morph1, context, "gh-dropdown", [], {"name": "user-actions-menu", "tagName": "ul", "classNames": "user-actions-menu dropdown-menu dropdown-triangle-top-right"}, child1, null);
        return fragment;
      }
    };
  }());
  var child2 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","form-group");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("label");
        dom.setAttribute(el2,"for","user-role");
        var el3 = dom.createTextNode("Role");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("What permissions should this user have?");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),2,3);
        inline(env, morph0, context, "gh-role-selector", [], {"initialValue": get(env, context, "user.role"), "onChange": "changeRole", "selectId": "user-role"});
        return fragment;
      }
    };
  }());
  var child3 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("            ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","form-group");
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("label");
        dom.setAttribute(el2,"for","user-password-old");
        var el3 = dom.createTextNode("Old Password");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n                ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n            ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),2,3);
        inline(env, morph0, context, "input", [], {"value": get(env, context, "user.password"), "type": "password", "id": "user-password-old"});
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("header");
      dom.setAttribute(el1,"class","settings-subview-header clearfix");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("h2");
      dom.setAttribute(el2,"class","page-title");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","page-actions");
      var el3 = dom.createTextNode("\n");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"class","btn btn-blue");
      var el4 = dom.createTextNode("Save");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("div");
      dom.setAttribute(el1,"class","content settings-user");
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("figure");
      dom.setAttribute(el2,"class","user-cover");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"class","btn btn-default user-cover-edit js-modal-cover");
      var el4 = dom.createTextNode("Change Cover");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"class","user-profile");
      dom.setAttribute(el2,"novalidate","novalidate");
      dom.setAttribute(el2,"autocomplete","off");
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("input");
      dom.setAttribute(el3,"style","display:none;");
      dom.setAttribute(el3,"type","text");
      dom.setAttribute(el3,"name","fakeusernameremembered");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("input");
      dom.setAttribute(el3,"style","display:none;");
      dom.setAttribute(el3,"type","password");
      dom.setAttribute(el3,"name","fakepasswordremembered");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      dom.setAttribute(el3,"class","user-details-top");
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("figure");
      dom.setAttribute(el4,"class","user-image");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("div");
      dom.setAttribute(el5,"id","user-image");
      dom.setAttribute(el5,"class","img");
      dom.setAttribute(el5,"href","#");
      var el6 = dom.createElement("span");
      dom.setAttribute(el6,"class","hidden");
      var el7 = dom.createTextNode("\"s Picture");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","edit-user-image js-modal-image");
      var el6 = dom.createTextNode("Edit Picture");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group first-form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-name");
      var el6 = dom.createTextNode("Full Name");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Use your real name so people can recognise you");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      dom.setAttribute(el3,"class","user-details-bottom");
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-slug");
      var el6 = dom.createTextNode("Slug");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("/author/");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-email");
      var el6 = dom.createTextNode("Email");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Used for notifications");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-location");
      var el6 = dom.createTextNode("Location");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Where in the world do you live?");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-website");
      var el6 = dom.createTextNode("Website");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Have a website or blog other than this one? Link it!");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group bio-container");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-bio");
      var el6 = dom.createTextNode("Bio");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("\n                    Write about you, in 200 characters or less.\n                    ");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n                ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("hr");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("fieldset");
      var el4 = dom.createTextNode("\n");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-password-new");
      var el6 = dom.createTextNode("New Password");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","user-new-password-verification");
      var el6 = dom.createTextNode("Verify Password");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-red button-change-password");
      var el6 = dom.createTextNode("Change Password");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, block = hooks.block, content = hooks.content, element = hooks.element, inline = hooks.inline;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element1 = dom.childAt(fragment, [0]);
      var element2 = dom.childAt(element1, [4]);
      var element3 = dom.childAt(element2, [2]);
      var element4 = dom.childAt(fragment, [2]);
      var element5 = dom.childAt(element4, [1]);
      var element6 = dom.childAt(element5, [1]);
      var element7 = dom.childAt(element4, [3]);
      var element8 = dom.childAt(element7, [5]);
      var element9 = dom.childAt(element8, [1]);
      var element10 = dom.childAt(element9, [1]);
      var element11 = dom.childAt(element9, [3]);
      var element12 = dom.childAt(element7, [7]);
      var element13 = dom.childAt(element12, [1]);
      var element14 = dom.childAt(element13, [4]);
      var element15 = dom.childAt(element12, [10]);
      var element16 = dom.childAt(element7, [9]);
      var element17 = dom.childAt(element16, [6, 1]);
      var morph0 = dom.createMorphAt(element1,0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element1, [2]),-1,-1);
      var morph2 = dom.createMorphAt(element2,0,1);
      var morph3 = dom.createMorphAt(dom.childAt(element10, [0]),-1,0);
      var morph4 = dom.createMorphAt(dom.childAt(element8, [3]),2,3);
      var morph5 = dom.createMorphAt(element13,2,3);
      var morph6 = dom.createMorphAt(element14,-1,0);
      var morph7 = dom.createMorphAt(element14,0,-1);
      var morph8 = dom.createMorphAt(dom.childAt(element12, [3]),2,3);
      var morph9 = dom.createMorphAt(element12,4,5);
      var morph10 = dom.createMorphAt(dom.childAt(element12, [6]),2,3);
      var morph11 = dom.createMorphAt(dom.childAt(element12, [8]),2,3);
      var morph12 = dom.createMorphAt(element15,2,3);
      var morph13 = dom.createMorphAt(dom.childAt(element15, [4]),0,1);
      var morph14 = dom.createMorphAt(element16,0,1);
      var morph15 = dom.createMorphAt(dom.childAt(element16, [2]),2,3);
      var morph16 = dom.createMorphAt(dom.childAt(element16, [4]),2,3);
      block(env, morph0, context, "unless", [get(env, context, "session.user.isAuthor")], {}, child0, null);
      content(env, morph1, context, "user.name");
      block(env, morph2, context, "if", [get(env, context, "view.userActionsAreVisible")], {}, child1, null);
      element(env, element3, context, "action", ["save"], {});
      element(env, element5, context, "bind-attr", [], {"style": get(env, context, "cover")});
      element(env, element6, context, "action", ["openModal", "upload", get(env, context, "user"), "cover"], {});
      element(env, element10, context, "bind-attr", [], {"style": get(env, context, "image")});
      content(env, morph3, context, "user.name");
      element(env, element11, context, "action", ["openModal", "upload", get(env, context, "user"), "image"], {});
      inline(env, morph4, context, "input", [], {"value": get(env, context, "user.name"), "id": "user-name", "class": "user-name", "placeholder": "Full Name", "autocorrect": "off"});
      inline(env, morph5, context, "gh-input", [], {"class": "user-name", "id": "user-slug", "value": get(env, context, "slugValue"), "name": "user", "focus-out": "updateSlug", "placeholder": "Slug", "selectOnClick": "true", "autocorrect": "off"});
      content(env, morph6, context, "gh-blog-url");
      content(env, morph7, context, "slugValue");
      inline(env, morph8, context, "input", [], {"type": "email", "value": get(env, context, "user.email"), "id": "user-email", "placeholder": "Email Address", "autocapitalize": "off", "autocorrect": "off", "autocomplete": "off"});
      block(env, morph9, context, "if", [get(env, context, "view.rolesDropdownIsVisible")], {}, child2, null);
      inline(env, morph10, context, "input", [], {"type": "text", "value": get(env, context, "user.location"), "id": "user-location"});
      inline(env, morph11, context, "input", [], {"type": "url", "value": get(env, context, "user.website"), "id": "user-website", "autocapitalize": "off", "autocorrect": "off", "autocomplete": "off"});
      inline(env, morph12, context, "textarea", [], {"id": "user-bio", "value": get(env, context, "user.bio")});
      inline(env, morph13, context, "gh-count-characters", [get(env, context, "user.bio")], {});
      block(env, morph14, context, "unless", [get(env, context, "view.isNotOwnProfile")], {}, child3, null);
      inline(env, morph15, context, "input", [], {"value": get(env, context, "user.newPassword"), "type": "password", "id": "user-password-new"});
      inline(env, morph16, context, "input", [], {"value": get(env, context, "user.ne2Password"), "type": "password", "id": "user-new-password-verification"});
      element(env, element17, context, "action", ["password"], {});
      return fragment;
    }
  };
}())); });

define('ghost/templates/setup', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","setup-box js-setup-box fade-in");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("div");
      dom.setAttribute(el2,"class","vertical");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("form");
      dom.setAttribute(el3,"id","setup");
      dom.setAttribute(el3,"class","setup-form");
      dom.setAttribute(el3,"method","post");
      dom.setAttribute(el3,"novalidate","novalidate");
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("input");
      dom.setAttribute(el4,"style","display:none;");
      dom.setAttribute(el4,"type","text");
      dom.setAttribute(el4,"name","fakeusernameremembered");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("input");
      dom.setAttribute(el4,"style","display:none;");
      dom.setAttribute(el4,"type","password");
      dom.setAttribute(el4,"name","fakepasswordremembered");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("header");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h1");
      var el6 = dom.createTextNode("Welcome to your new Ghost blog");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h2");
      var el6 = dom.createTextNode("Let's get a few things set up so you can get started.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","blog-title");
      var el6 = dom.createTextNode("Blog Title");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("What would you like to call your blog?");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","name");
      var el6 = dom.createTextNode("Full Name");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("The name that you will sign your posts with");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","email");
      var el6 = dom.createTextNode("Email Address");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Used for important notifications");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","password");
      var el6 = dom.createTextNode("Password");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Must be at least 8 characters");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("footer");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","submit");
      dom.setAttribute(el5,"class","btn btn-green btn-lg");
      var el6 = dom.createTextNode("Ok, Let's Do This");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, inline = hooks.inline, element = hooks.element;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1, 1]);
      var element1 = dom.childAt(element0, [15, 1]);
      var morph0 = dom.createMorphAt(dom.childAt(element0, [7]),2,3);
      var morph1 = dom.createMorphAt(dom.childAt(element0, [9]),2,3);
      var morph2 = dom.createMorphAt(dom.childAt(element0, [11]),2,3);
      var morph3 = dom.createMorphAt(dom.childAt(element0, [13]),2,3);
      inline(env, morph0, context, "input", [], {"type": "text", "name": "blog-title", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "blogTitle")});
      inline(env, morph1, context, "input", [], {"type": "text", "name": "name", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "name")});
      inline(env, morph2, context, "input", [], {"type": "email", "name": "email", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "email")});
      inline(env, morph3, context, "input", [], {"type": "password", "name": "password", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "password")});
      element(env, element1, context, "action", ["setup"], {});
      element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "submitting")});
      return fragment;
    }
  };
}())); });

define('ghost/templates/signin', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      isHTMLBars: true,
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createTextNode("Forgotten password?");
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }());
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","login-box js-login-box fade-in");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("form");
      dom.setAttribute(el2,"id","login");
      dom.setAttribute(el2,"class","login-form");
      dom.setAttribute(el2,"method","post");
      dom.setAttribute(el2,"novalidate","novalidate");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","email-wrap");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("span");
      dom.setAttribute(el4,"class","input-icon icon-mail");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","password-wrap");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("span");
      dom.setAttribute(el4,"class","input-icon icon-lock");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("button");
      dom.setAttribute(el3,"class","btn btn-blue");
      dom.setAttribute(el3,"type","submit");
      var el4 = dom.createTextNode("Log in");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("section");
      dom.setAttribute(el3,"class","meta");
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, block = hooks.block;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1]);
      var element1 = dom.childAt(element0, [5]);
      var morph0 = dom.createMorphAt(dom.childAt(element0, [1, 1]),0,1);
      var morph1 = dom.createMorphAt(dom.childAt(element0, [3, 1]),0,1);
      var morph2 = dom.createMorphAt(dom.childAt(element0, [7]),0,1);
      element(env, element0, context, "action", ["validateAndAuthenticate"], {"on": "submit"});
      inline(env, morph0, context, "gh-trim-focus-input", [], {"class": "email", "type": "email", "placeholder": "Email Address", "name": "identification", "autocapitalize": "off", "autocorrect": "off", "value": get(env, context, "model.identification")});
      inline(env, morph1, context, "input", [], {"class": "password", "type": "password", "placeholder": "Password", "name": "password", "value": get(env, context, "model.password")});
      element(env, element1, context, "action", ["validateAndAuthenticate"], {});
      element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "submitting")});
      block(env, morph2, context, "link-to", ["forgotten"], {"class": "forgotten-password"}, child0, null);
      return fragment;
    }
  };
}())); });

define('ghost/templates/signup', ['exports'], function(__exports__){ __exports__['default'] = Ember.HTMLBars.template((function() {
  return {
    isHTMLBars: true,
    blockParams: 0,
    cachedFragment: null,
    hasRendered: false,
    build: function build(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","setup-box js-signup-box fade-in");
      var el2 = dom.createTextNode("\n    ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("div");
      dom.setAttribute(el2,"class","vertical");
      var el3 = dom.createTextNode("\n        ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("form");
      dom.setAttribute(el3,"id","signup");
      dom.setAttribute(el3,"class","setup-form");
      dom.setAttribute(el3,"method","post");
      dom.setAttribute(el3,"novalidate","novalidate");
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("input");
      dom.setAttribute(el4,"style","display:none;");
      dom.setAttribute(el4,"type","text");
      dom.setAttribute(el4,"name","fakeusernameremembered");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("input");
      dom.setAttribute(el4,"style","display:none;");
      dom.setAttribute(el4,"type","password");
      dom.setAttribute(el4,"name","fakepasswordremembered");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("header");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h1");
      var el6 = dom.createTextNode("Welcome to Ghost");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h2");
      var el6 = dom.createTextNode("Create your account to start publishing");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","email");
      var el6 = dom.createTextNode("Email Address");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Used for important notifications");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","name");
      var el6 = dom.createTextNode("Full Name");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("The name that you will sign your posts with");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","form-group");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("label");
      dom.setAttribute(el5,"for","password");
      var el6 = dom.createTextNode("Password");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Must be at least 8 characters");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n            ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("footer");
      var el5 = dom.createTextNode("\n                ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","submit");
      dom.setAttribute(el5,"class","btn btn-green btn-lg");
      var el6 = dom.createTextNode("Create Account");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n            ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n        ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    render: function render(context, env, contextualElement) {
      var dom = env.dom;
      var hooks = env.hooks, get = hooks.get, inline = hooks.inline, element = hooks.element;
      dom.detectNamespace(contextualElement);
      var fragment;
      if (env.useFragmentCache && dom.canClone) {
        if (this.cachedFragment === null) {
          fragment = this.build(dom);
          if (this.hasRendered) {
            this.cachedFragment = fragment;
          } else {
            this.hasRendered = true;
          }
        }
        if (this.cachedFragment) {
          fragment = dom.cloneNode(this.cachedFragment, true);
        }
      } else {
        fragment = this.build(dom);
      }
      var element0 = dom.childAt(fragment, [0, 1, 1]);
      var element1 = dom.childAt(element0, [13, 1]);
      var morph0 = dom.createMorphAt(dom.childAt(element0, [7]),2,3);
      var morph1 = dom.createMorphAt(dom.childAt(element0, [9]),2,3);
      var morph2 = dom.createMorphAt(dom.childAt(element0, [11]),2,3);
      inline(env, morph0, context, "input", [], {"type": "email", "name": "email", "autocorrect": "off", "value": get(env, context, "model.email")});
      inline(env, morph1, context, "gh-trim-focus-input", [], {"type": "text", "name": "name", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "model.name")});
      inline(env, morph2, context, "input", [], {"type": "password", "name": "password", "autofocus": "autofocus", "autocorrect": "off", "value": get(env, context, "model.password")});
      element(env, element1, context, "action", ["signup"], {});
      element(env, element1, context, "bind-attr", [], {"disabled": get(env, context, "submitting")});
      return fragment;
    }
  };
}())); });
// Loader to create the Ember.js application
/*global require */

if (!window.disableBoot) {
    window.App = require('ghost/app').default.create();
}

//# sourceMappingURL=ghost.js.map