sap.ui.define([
   'sap/ui/core/mvc/Controller',
   'sap/ui/model/json/JSONModel'
], function (Controller, JSONModel) {
   "use strict";

   return Controller.extend("sap.ui.jsroot.GuiPanelController", {

      onInit : function() {
         var id = this.getView().getId();
         console.log("Initialization GuiPanel id = " + id);

         var oModel = sap.ui.getCore().getModel(id);

         if (oModel) {
            this.websocket = oModel.getData().handle;
            this.websocket.SetReceiver(this); // redirect websocket handling on controller itself
            this.websocket.Send("PANEL_READY"); // confirm panel creation, only then GUI can send commands
         }

         if (this.onPanelInit) this.onPanelInit();
      },

      OnWebsocketOpened: function(handle) {
         console.log('Connection established - should never happen');
      },

      OnWebsocketMsg: function(handle, msg) {
          console.log('GuiPanel Get message ' + msg);
      },

      OnWebsocketClosed: function(handle) {
          console.log('GuiPanel closed');
          if (window) window.open('','_self').close(); // window.close();
          delete this.websocket; // remove reference on websocket
      },

      onExit : function() {
         if (this.onPanelExit) this.onPanelExit();
         console.log("Closing GuiPanel id = " + this.getView().getId());
         if (this.websocket) {
            this.websocket.Close();
            delete this.websocket;
         }
      },

      closePanel : function() {
         var main = sap.ui.getCore().byId("TopCanvasId");
         if (main) main.getController().showLeftArea("");
         else if (window) window.open('','_self').close(); // window.close();
      }

   });

});
