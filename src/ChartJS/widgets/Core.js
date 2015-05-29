/*jslint white:true, nomen: true, plusplus: true */
/*global mx, mxui, mendix, require, console, define, module, logger, ChartJS, position, clearTimeout, setTimeout */
/*mendix */

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([

    // Mixins
    "dojo/_base/declare", "mxui/widget/_WidgetBase", "dijit/_TemplatedMixin",

    // Client API and DOJO functions
    "mxui/dom", "dojo/dom", "dojo/query", "dojo/dom-prop", "dojo/dom-geometry", "dojo/dom-class", "dojo/dom-attr", "dojo/dom-style", "dojo/_base/window", "dojo/dom-construct", "dojo/_base/array", "dojo/_base/lang", "dojo/html", "dojo/ready",

    // External libraries
    "ChartJS/lib/charts",

    // Templates
    "dojo/text!ChartJS/templates/chartjs.html",
    "dojo/text!ChartJS/templates/tooltip.html"

], function (

       // Mixins
       declare, _WidgetBase, _TemplatedMixin,

        // Client API and DOJO functions
        dom, dojoDom, domQuery, domProp, domGeom, domClass, domAttr, domStyle, win, domConstruct, dojoArray, lang, html, ready,

        // External libraries 
        _charts,

        // Templates
        _chartJSTemplate,
        _chartJSTooltipTemplate) {

    "use strict";

    // Declare widget.
    return declare([_WidgetBase, _TemplatedMixin], {

        // Template path
        templateString: _chartJSTemplate,

        // Internal variables
        _chartJS: null,
        _chart: null,
        _ctx: null,
        _dataset: null,
        _datasetCounter: 0,
        _data: null,
        _chartData: null,
        _activeDatasets: null,
        _legendNode: null,
        _mxObj: null,
        _handle: null,

        _currentContext: null,
        _addedToBody: false,

        startup: function () {

            var domNode = null;

            // Activate chartJS.
            this._chartJS = _charts().chartssrc();

            ///Boolean - Whether the chart is responsive
            this._chartJS.defaults.global.responsive = this.responsive;

            // Hack to fix the tooltip event, also added "mouseover"
            this._chartJS.defaults.global.tooltipEvents = ["mouseover", "mouseup", "mousedown", "mousemove", "touchstart", "touchmove", "mouseout"];
            this._chartJS.defaults.global.tooltipXOffset = 0;

            // Set object , dataset and datapoint.
            this._dataset = this.datasetentity.split("/")[0];
            this._datapoint = this.datapointentity && this.datapointentity.split("/")[0];
            this._data = {};
            this._documentReady = false;

            this._createCtx();

            this._chartData = {
                contextObj: null,
                datasets: []
            };

            this._activeDatasets = [];

            if (!dojoDom.byId("chartjsTooltip")) {
                domNode = domConstruct.toDom(_chartJSTooltipTemplate);
                domConstruct.place(domNode, win.body());
            }

        },

        datasetAdd: function (dataset, datapoints) {
            var set = {
                dataset: dataset,
                sorting: +(dataset.get(this.datasetsorting))
            };
            if (datapoints.length === 1) {
                set.point = datapoints[0];
                set.points = datapoints;
            } else {
                set.points = datapoints;
            }

            this._data.datasets.push(set);

            this._datasetCounter--;
            if (this._datasetCounter === 0) {
                this._processData();
            }
        },

        update: function (obj, callback) {

            this._mxObj = obj;

            if (this._handle !== null) {
                mx.data.unsubscribe(this._handle);
            }
            this._handle = mx.data.subscribe({
                guid: this._mxObj.getGuid(),
                callback: lang.hitch(this, this._loadData)
            });

            // Load data again.
            this._loadData();

            if (typeof callback !== "undefined") {
                callback();
            }
        },

        _loadData: function () {

            this._data = {
                object: this._mxObj,
                datasets: []
            };

            this._executeMicroflow(this.datasourcemf, lang.hitch(this, function (objs) {
                var obj = objs[0], // Chart object is always only one.
                    j = null,
                    dataset = null,
                    pointguids = null;

                this._data.object = obj;
                this._data.datasets = [];
                this._activeDatasets = [];

                // Retrieve datasets
                mx.data.get({
                    guids: obj.get(this._dataset),
                    callback: lang.hitch(this, function (datasets) {
                        var set = {};

                        this._datasetCounter = datasets.length;
                        this._data.datasets = [];

                        for (j = 0; j < datasets.length; j++) {
                            dataset = datasets[j];
                            pointguids = dataset.get(this._datapoint);
                            if (typeof pointguids === "string" && pointguids !== "") {
                                pointguids = [pointguids];
                            }
                            if (typeof pointguids !== "string") {
                                mx.data.get({
                                    guids: pointguids,
                                    callback: lang.hitch(this, this.datasetAdd, dataset)
                                });
                            } else {
                                this.datasetAdd(dataset, []);
                            }
                        }

                    })
                });
            }), this._mxObj);

        },

        uninitialize: function () {
            if (this._handle !== null) {
                mx.data.unsubscribe(this._handle);
            }
        },

        customTooltip: function (tooltip) {

            // Tooltip Element
            var tooltipEl = domQuery("#chartjsTooltip")[0],
                tooltipElContent = domQuery("#chartjsTooltip .content")[0],
                top = null,
                contextObj = null;

            // Hide if no tooltip
            if (!tooltip) {
                domStyle.set(tooltipEl, "opacity", 0);
                return;
            }

            // Set caret Position
            domClass.remove(tooltipEl, "above below");
            domClass.add(tooltipEl, tooltip.yAlign);

            // Set Text
            domConstruct.empty(tooltipElContent);

            // Construct the tooltip form
            if (typeof this.tooltipForm !== "undefined" && this.tooltipForm !== "") {
                contextObj = new mendix.lib.MxContext();
                contextObj.setTrackObject(this._mxObj);
                this._tooltip = mx.ui.openForm(this.tooltipForm, {
                    location: "content",
                    context: contextObj,
                    domNode: tooltipElContent,
                    callback: function (form) {
                        var whatEver = null;
                    }
                }, this);
            } else {
                html.set(tooltipElContent, domConstruct.create("span", {
                    innerHTML: tooltip.text + " - custom tooltip!!!"
                }));
            }

            // Find Y Location on page
            if (tooltip.yAlign === "above") {
                top = tooltip.y - tooltip.caretHeight - tooltip.caretPadding;
            } else {
                top = tooltip.y + tooltip.caretHeight + tooltip.caretPadding;
            }

            // Display, position, and set styles for font
            domStyle.set(tooltipEl, "opacity", 1);
            domStyle.set(tooltipEl, "left", tooltip.chart.canvas.offsetLeft + (tooltip.x - 7.5) + "px");
            domStyle.set(tooltipEl, "top", tooltip.chart.canvas.offsetTop + tooltip.y + "px");
            domStyle.set(tooltipEl, "font-family", tooltip.fontFamily);
            domStyle.set(tooltipEl, "font-size", tooltip.fontSize);
            domStyle.set(tooltipEl, "font-style", tooltip.fontStyle);

        },

        _createCtx: function () {
            var position = domGeom.position(this.domNode.parentElement, false);
            domAttr.set(this.canvasNode, "id", "canvasid_" + this.id);

            if (position.w > 0 && this.responsive) {
                this.canvasNode.width = position.w;
            } else {
                this.canvasNode.width = this.width;
            }

            if (position.h > 0 && this.responsive) {
                this.canvasNode.height = position.h;
            } else {
                this.canvasNode.height = this.height;
            }

            this._ctx = this.canvasNode.getContext("2d");

        },

        _processData: function () {
            // STUB
            console.error("_processData: This is placeholder function that should be overwritten by the implementing widget.");
        },

        _createChart: function (data) {
            // STUB
            console.error("_createChart: This is placeholder function that should be overwritten by the implementing widget.", data);
        },

        _onClickChart: function () {
            if (this.onclickmf) {
                this._executeMicroflow(this.onclickmf);
            }
        },

        _createLegend: function (isSingleSeries) {
            var listNodes = null,
                k = null;

            if (this.showLegend) {
                this._legendNode.innerHTML = this._chart.generateLegend();

                listNodes = domQuery("li", this._legendNode);

                if (listNodes.length > 0) {
                    for (k = 0; k < listNodes.length; k++) {
                        this.connect(listNodes[k], "click", lang.hitch(this, this._onClickLegend, k, isSingleSeries));
                    }
                }
            }
        },

        _onClickLegend: function (idx, isSingleSeries) {
            var activeSet = null,
                activeSetLegend = null,
                newDatasets = {
                    datasets: [],
                    labels: this._chartData.labels
                },
                i = null;

            this._activeDatasets[idx].active = !this._activeDatasets[idx].active;

            this._chart.destroy();
            for (i = 0; i < this._activeDatasets.length; i++) {
                activeSet = this._activeDatasets[i];
                activeSetLegend = domQuery("li", this._legendNode)[activeSet.idx];

                if (activeSet.active) {
                    if (domClass.contains(activeSetLegend, "legend-inactive")) {
                        domClass.remove(activeSetLegend, "legend-inactive");
                    }

                    newDatasets.datasets.push(activeSet.dataset);
                } else if (!domClass.contains(activeSetLegend, "legend-inactive")) {
                    domClass.add(activeSetLegend, "legend-inactive");
                }
            }
            if (isSingleSeries) {
                this._createChart(newDatasets.datasets);
            } else {
                this._createChart(newDatasets);
            }
        },

        _sortArrayObj: function (values) {
            return values.sort(lang.hitch(this, function (a, b) {
                var aa = +(a.sorting),
                    bb = +(b.sorting);
                if (aa > bb) {
                    return 1;
                }
                if (aa < bb) {
                    return -1;
                }
                // a must be equal to b
                return 0;
            }));
        },

        _sortArrayMx: function (values, sortAttr) {
            return values.sort(lang.hitch(this, function (a, b) {
                var aa = +(a.get(sortAttr)),
                    bb = +(b.get(sortAttr));
                //if the attribute is numeric
                aa = a.isNumber(sortAttr) ? parseFloat(aa) : aa;
                bb = b.isNumber(sortAttr) ? parseFloat(bb) : bb;
                if (aa > bb) {
                    return 1;
                }
                if (aa < bb) {
                    return -1;
                }
                // a must be equal to b
                return 0;
            }));
        },

        _addChartClass: function (className) {
            domClass.remove(this.domNode, className);
            domClass.add(this.domNode, className);
        },

        _resize: function () {

            var position = domGeom.position(this.domNode.parentElement, false);

            //Only resize when chart is set to responsive and width and height of parent element > 0
            if (this._chart && this.responsive && position.w > 0 && position.h > 0) {
                this._chart.resize();
            }
        },

        _hexToRgb: function (hex, alpha) {
            var regex = null,
                shorthandRegex = null,
                result = null;

            // From Stackoverflow here: http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
            // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
            shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(shorthandRegex, function (m, r, g, b) {
                return r + r + g + g + b + b;
            });

            regex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (regex) {
                result = {
                    r: parseInt(regex[1], 16),
                    g: parseInt(regex[2], 16),
                    b: parseInt(regex[3], 16)
                };
                return "rgba(" + result.r + "," + result.g + "," + result.b + "," + alpha + ")";
            }
            return "rgba(220,220,220," + alpha + ")";
        },

        _executeMicroflow: function (mf, callback, obj) {
            var _params = {
                applyto: "selection",
                actionname: mf,
                guids: []
            };

            if (obj && obj.getGuid()) {
                _params.guids = [obj.getGuid()];
            }

            mx.data.action({
                params: _params,
                callback: lang.hitch(this, function (obj) {
                    if (typeof callback !== "undefined") {
                        callback(obj);
                    }
                }),
                error: function (error) {
                    console.log(error.description);
                }
            }, this);
        }

    });
});