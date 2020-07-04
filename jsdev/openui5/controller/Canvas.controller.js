sap.ui.define([
   'jquery.sap.global',
   'sap/ui/core/mvc/Controller',
   'sap/ui/model/json/JSONModel',
   'sap/m/MessageToast',
   'sap/m/Dialog',
   'sap/m/List',
   'sap/m/InputListItem',
   'sap/m/Input',
   'sap/m/Button',
   'sap/m/Label',
   'sap/ui/layout/Splitter',
   'sap/ui/layout/SplitterLayoutData',
   'sap/ui/unified/Menu',
   'sap/ui/unified/MenuItem'

], function (jQuery, Controller, JSONModel, MessageToast, Dialog, List, InputListItem, Input, Button, Label, Splitter, SplitterLayoutData, Menu, MenuItem) {
   "use strict";

   var CController = Controller.extend("sap.ui.jsroot.controller.Canvas", {
      onInit : function() {
         this._Page = this.getView().byId("CanvasMainPage");
         this.bottomVisible = false;

         var model = new JSONModel({ GedIcon: "", StatusIcon: "", ToolbarIcon: "", TooltipIcon: "sap-icon://accept",
                                     StatusLbl1:"", StatusLbl2:"", StatusLbl3:"", StatusLbl4:"" });
         this.getView().setModel(model);

         var data = this.getView().getViewData();

         if (data) {
            this.getView().byId("MainPanel").getController().setPainter(data.canvas_painter);
            delete data.canvas_painter;
         }

         // this.toggleGedEditor();
      },

      getCanvasPainter : function(also_without_websocket) {
         var elem = this.getView().byId("MainPanel");

         var p = elem ? elem.getController().getPainter() : null;

         return (p && (p._websocket || also_without_websocket)) ? p : null;
      },

      closeMethodDialog : function(method, call_back) {

         var args = "";

         if (method) {
            var cont = this.methodDialog.getContent();

            var items = cont[0].getItems();

            if (method.fArgs.length !== items.length)
               alert('Mismatch between method description' + method.fArgs.length + ' and args list in dialog ' + items.length);

            // console.log('ITEMS', method.fArgs.length, items.length);

            for (var k=0;k<method.fArgs.length;++k) {
               var arg = method.fArgs[k];
               var value = items[k].getContent()[0].getValue();

               if (value==="") value = arg.fDefault;

               if ((arg.fTitle=="Option_t*") || (arg.fTitle=="const char*")) {
                  // check quotes,
                  // TODO: need to make more precise checking of escape characters
                  if (!value) value = '""';
                  if (value[0]!='"') value = '"' + value;
                  if (value[value.length-1] != '"') value += '"';
               }

               args += (k>0 ? "," : "") + value;
            }
         }

         this.methodDialog.close();
         this.methodDialog.destroy();
         JSROOT.CallBack(call_back, args);
      },

      showMethodsDialog : function(method, call_back) {
         var items = [];

         for (var n=0;n<method.fArgs.length;++n) {
            var arg = method.fArgs[n];
            arg.fValue = arg.fDefault;
            if (arg.fValue == '\"\"') arg.fValue = "";
            var item = new InputListItem({
               label: arg.fName + " (" +arg.fTitle + ")",
               content: new Input({ placeholder: arg.fName, value: arg.fValue })
            });
            items.push(item);
         }

         this.methodDialog = new Dialog({
            title: method.fClassName + '::' + method.fName,
            content: new List({
                 items: items
//              items: {
//                 path: '/Method/fArgs',
//                 template: new InputListItem({
//                    label: "{fName} ({fTitle})",
//                    content: new Input({placeholder: "{fName}", value: "{fValue}" })
//                 })
//              }
             }),
             beginButton: new Button({
               text: 'Cancel',
               press: this.closeMethodDialog.bind(this, null, null)
             }),
             endButton: new Button({
               text: 'Ok',
               press: this.closeMethodDialog.bind(this, method, call_back)
             })
         });

         // this.getView().getModel().setProperty("/Method", method);
         //to get access to the global model
         // this.getView().addDependent(this.methodDialog);

         this.methodDialog.addStyleClass("sapUiSizeCompact");

         this.methodDialog.open();
      },

      onFileMenuAction : function (oEvent) {
         //var oItem = oEvent.getParameter("item"),
         //    sItemPath = "";
         //while (oItem instanceof sap.m.MenuItem) {
         //   sItemPath = oItem.getText() + " > " + sItemPath;
         //   oItem = oItem.getParent();
         //}
         //sItemPath = sItemPath.substr(0, sItemPath.lastIndexOf(" > "));

         var p = this.getCanvasPainter();
         if (!p) return;

         var name = oEvent.getParameter("item").getText();

         switch (name) {
            case "Close canvas": p.OnWebsocketClosed(); p.CloseWebsocket(true); break;
            case "Interrupt": p.SendWebsocket("INTERRUPT"); break;
            case "Quit ROOT": p.SendWebsocket("QUIT"); break;
            case "Canvas.png":
            case "Canvas.jpeg":
            case "Canvas.svg":
               p.SaveCanvasAsFile(name);
               break;
            case "Canvas.root":
            case "Canvas.pdf":
            case "Canvas.ps":
            case "Canvas.C":
               p.SendSaveCommand(name);
               break;
         }

         MessageToast.show("Action triggered on item: " + name);
      },

      onCloseCanvasPress : function() {
         var p = this.getCanvasPainter();
         if (p) {
            p.OnWebsocketClosed();
            p.CloseWebsocket(true);
         }
      },

      onInterruptPress : function() {
         var p = this.getCanvasPainter();
         if (p) p.SendWebsocket("INTERRUPT");
      },

      onQuitRootPress : function() {
         var p = this.getCanvasPainter();
         if (p) p.SendWebsocket("QUIT");
      },

      onReloadPress : function() {
         var p = this.getCanvasPainter();
         if (p) p.SendWebsocket("RELOAD");
      },

      isGedEditor : function() {
         return this.getView().getModel().getProperty("/LeftArea") == "Ged";
      },

      showGeEditor : function(new_state) {
         this.showLeftArea(new_state ? "Ged" : "");
         this.getView().getModel().setProperty("/GedIcon", new_state ? "sap-icon://accept" : "");

      },

      cleanupIfGed : function() {
         var ged = this.getLeftController("Ged"),
             p = this.getCanvasPainter();
         if (ged) ged.cleanupGed();
         if (p) p.RegisterForPadEvents(null);
      },

      getLeftController : function(name) {
         if (this.getView().getModel().getProperty("/LeftArea") != name) return null;
         var split = this.getView().byId("MainAreaSplitter");
         return split ? split.getContentAreas()[0].getController() : null;
      },

      toggleGedEditor : function() {
         this.showGeEditor(!this.isGedEditor());
      },

      showPanelInLeftArea : function(panel_name, panel_handle, call_back) {

         var split = this.getView().byId("MainAreaSplitter");
         var curr = this.getView().getModel().getProperty("/LeftArea");
         if (!split || (curr === panel_name)) return JSROOT.CallBack(call_back, false);

         // first need to remove existing
         if (curr) {
            this.cleanupIfGed();
            split.removeContentArea(split.getContentAreas()[0]);
         }

         this.getView().getModel().setProperty("/LeftArea", panel_name);
         this.getView().getModel().setProperty("/GedIcon", (panel_name=="Ged") ? "sap-icon://accept" : "");

         if (!panel_handle || !panel_name) return JSROOT.CallBack(call_back, false);

         var oLd = new SplitterLayoutData({
            resizable : true,
            size      : "250px",
            maxSize   : "500px"
         });

         var panelid = "LeftPanelId";

         var oModel = new JSROOT.sap.ui.model.json.JSONModel({
            handle: panel_handle
         });
         sap.ui.getCore().setModel(oModel, panelid);

         var oContent = sap.ui.xmlview({
            id: panelid,
            viewName : "sap.ui.jsroot.view." + panel_name,
            layoutData: oLd,
            height: panel_name=="Panel" ? "100%" : undefined
         });

         split.insertContentArea(oContent, 0);

         JSROOT.CallBack(call_back, true);
      },

      showLeftArea : function(panel_name, call_back) {
         var split = this.getView().byId("MainAreaSplitter");
         var curr = this.getView().getModel().getProperty("/LeftArea");
         if (!split || (curr === panel_name)) return JSROOT.CallBack(call_back, false);

         // first need to remove existing
         if (curr) {
            this.cleanupIfGed();
            split.removeContentArea(split.getContentAreas()[0]);
         }

         this.getView().getModel().setProperty("/LeftArea", panel_name);
         this.getView().getModel().setProperty("/GedIcon", (panel_name=="Ged") ? "sap-icon://accept" : "");

         if (!panel_name) return JSROOT.CallBack(call_back, false);

         var oLd = new SplitterLayoutData({
            resizable : true,
            size      : "250px",
            maxSize   : "500px"
         });

         var oContent = sap.ui.xmlview({
            viewName : "sap.ui.jsroot.view." + panel_name,
            layoutData: oLd,
            height: panel_name=="Panel" ? "100%" : undefined
         });

         split.insertContentArea(oContent, 0);

         if (panel_name === "Ged") {
            var ged = oContent.getController(), p = this.getCanvasPainter();
            if (p && ged && (typeof p.RegisterForPadEvents == "function")) {
               p.RegisterForPadEvents(ged.padEventsReceiver.bind(ged));
               p.SelectObjectPainter(p);
            }
         }

         JSROOT.CallBack(call_back, true);

         return oContent.getController(); // return controller of new panel
      },

      getBottomController : function(can, call_back) {
         if (!this.bottomVisible) return null;
         var split = this.getView().byId("MainAreaSplitter");
         var cont = split.getContentAreas();
         var vsplit = cont[cont.length-1];
         var vcont = vsplit.getContentAreas();
         var bottom = vcont[vcont.length-1];
         return bottom ? bottom.getController() : null;
      },

      drawInProjectionArea : function(can, opt, call_back) {
         var ctrl = this.getBottomController();
         if (!ctrl) ctrl = this.getLeftController("Panel");

         if (ctrl && ctrl.drawObject)
            ctrl.drawObject(can, opt, call_back);
         else
            JSROOT.CallBack(call_back, null);
      },

      showProjectionArea : function(kind, call_back) {
         var bottom = this.showBottomArea(kind == "X");
         var left = this.showLeftArea(kind == "Y" ? "Panel" : "");

         var ctrl = bottom || left;

         if (!ctrl || ctrl.getView().getDomRef())
            return JSROOT.CallBack(call_back, !!ctrl);

         if (ctrl.rendering_perfromed) console.log('Rendering already done');

         // FIXME: one should have much easier way to get callback when rendering done
         ctrl.after_render_callback = call_back;
      },

      showBottomArea : function(is_on) {

         if (this.bottomVisible == is_on) return this.getBottomController();

         var split = this.getView().byId("MainAreaSplitter");

         if (!split) return null;

         var cont = split.getContentAreas();

         this.bottomVisible = !this.bottomVisible;

         if (this.bottomVisible == false) {
            // vertical splitter exists - toggle it

            var vsplit = cont[cont.length-1];
            var main = vsplit.removeContentArea(0);
            vsplit.destroyContentAreas();
            split.removeContentArea(vsplit);
            split.addContentArea(main);
            return null;
         }

         // remove panel with normal drawing
         split.removeContentArea(cont[cont.length-1]);
         var vsplit = new Splitter({orientation: "Vertical"});

         split.addContentArea(vsplit);

         vsplit.addContentArea(cont[cont.length-1]);

         var oLd = new SplitterLayoutData({
            resizable : true,
            size      : "200px",
            maxSize   : "500px"
         });

         var oContent = sap.ui.xmlview({
            viewName : "sap.ui.jsroot.view.Panel",
            layoutData: oLd,
            height: "100%"
         });

         vsplit.addContentArea(oContent);

         return oContent.getController();
      },

      ShowCanvasStatus : function (text1,text2,text3,text4) {
         var model = this.getView().getModel();
         model.setProperty("/StatusLbl1", text1);
         model.setProperty("/StatusLbl2", text2);
         model.setProperty("/StatusLbl3", text3);
         model.setProperty("/StatusLbl4", text4);
      },

      isStatusShown : function() {
         return this._Page.getShowFooter();
      },

      toggleShowStatus : function(new_state) {
         if (new_state === undefined) new_state = !this.isStatusShown();

         this._Page.setShowFooter(new_state);
         this.getView().getModel().setProperty("/StatusIcon", new_state ? "sap-icon://accept" : "");
      },

      toggleToolBar : function(new_state) {
         if (new_state === undefined) new_state = !this.getView().getModel().getProperty("/ToolbarIcon");

         this._Page.setShowSubHeader(new_state);

         this.getView().getModel().setProperty("/ToolbarIcon", new_state ? "sap-icon://accept" : "");
      },

      toggleToolTip : function(new_state) {
         if (new_state === undefined) new_state = !this.getView().getModel().getProperty("/TooltipIcon");

         this.getView().getModel().setProperty("/TooltipIcon", new_state ? "sap-icon://accept" : "");

         var p = this.getCanvasPainter(true);
         if (p) p.SetTooltipAllowed(new_state);
      },

      setShowMenu : function(new_state) {
         this._Page.setShowHeader(new_state);
      },

      onViewMenuAction : function (oEvent) {

         var item = oEvent.getParameter("item");

         switch (item.getText()) {
            case "Editor": this.toggleGedEditor(); break;
            case "Event statusbar": this.toggleShowStatus(); break;
            case "Toolbar": this.toggleToolBar(); break;
            case "Tooltip info": this.toggleToolTip(); break;
         }
      },

      onToolsMenuAction : function(oEvent) {
         var item = oEvent.getParameter("item"),
             name = item.getText();

         if (name != "Fit panel") return;

         var curr = this.getView().getModel().getProperty("/LeftArea");

         this.showLeftArea(curr == "FitPanel" ? "" : "FitPanel");
      },

      showMessage : function(msg) {
         MessageToast.show(msg);
      },

      showSection : function(that, on) {
         // this function call when section state changed from server side
         switch(that) {
            case "Menu": this.setShowMenu(on); break;
            case "StatusBar": this.toggleShowStatus(on); break;
            case "Editor": this.showGeEditor(on); break;
            case "ToolBar": this.toggleToolBar(on); break;
            case "ToolTips": this.toggleToolTip(on); break;
         }
      }
   });
   return CController;

});
