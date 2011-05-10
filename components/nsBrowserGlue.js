const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

/* For debugging only */
function alert(msg)
{
  Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService)
    .alert(null, "AOI alert", msg);
};

function getChromeWindow(aWindow) {
  return aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIDocShell)
                .chromeEventHandler.ownerDocument.defaultView.wrappedJSObject;
}

function XPInstallPrompt() {}

XPInstallPrompt.prototype = {
  classID:          Components.ID("{d32ccdf1-c93f-4d3f-95cc-8e18e28da698}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.amIWebInstallPrompt]),

  _getBrowserAndChromeWin: function XPIP__getBrowserAndChromeWin(aWindow, aURL) {

    // TODO: this happens when an add-on is installed when dragged on the
    // browser or through File > Open. We should open the content area UI
    // described in bug 476430.
    // Temporary workaround: The exception will open the old prompt.
    /*
    if (!aURL) {
      throw new Error("Intentional error to fall back to old prompt");
      return [null, null];
    }
    */

    if (!aWindow.document)
      return [null, null];

    let chromeWin;
    try {
      chromeWin = getChromeWindow(aWindow);
    } catch (e) {
      // That could happen if the window is closed.
      //return [null, null];
      chromeWin = Services.wm.getMostRecentWindow("navigator:browser");
    }

    let browser = chromeWin.gBrowser.getBrowserForDocument(aWindow.document);

    // Cancel installation if the user navigated to another URL.
    /*
     if (browser.currentURI.spec != aURL.spec) {
      
      return [null, null];
    }
    */

    return [browser, chromeWin];
  },

  confirm: function XPIP_confirm(aWindow, aURL, aInstalls) {

    let [browser, chromeWin] = this._getBrowserAndChromeWin(aWindow, aURL);
    if (!browser) {
      aInstalls.forEach(function(install) {
        install.cancel();
      });
      return;
    }

    // Check for install of local file, not tied to a site so doorhanger not appropriate
    // So set objects to fall back to old prompt
    var isLocal = (aInstalls[0].sourceURI.scheme == "file");
    if (isLocal) {
        browser = null;
        chromeWin = null;
    }

    let browserBundle = Services.strings.createBundle("chrome://aoi/locale/browser.properties");
    let brandBundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");
    let appName = brandBundle.GetStringFromName("brandShortName");

    let mainAction = {
      label: browserBundle.formatStringFromName("xpinstallAddButton", [appName], 1),
      accessKey: browserBundle.GetStringFromName("xpinstallAddButton.accesskey"),
      callback: function() {
        // Defer the addon installation to let the notification panel close.
        // Useful for tests relying on popupshown events.
        Services.tm.mainThread.dispatch({
          run: function() {
            aInstalls.forEach(function(install) {
              install.install();
            });
          }
        }, Ci.nsIThread.DISPATCH_NORMAL);
      }
    };

    // TODO (maybe): listen to the "remove" event and drop the "removeOnDismissal"
    // option once bug 609804 is fixed.
    let options = {
      eventCallback: function(eventName) {
        if (eventName != "dismissed")
          return;

        aInstalls.forEach(function(install) {
          install.cancel();
        });

        // Now manually remove the notification
        // If we use removeOnDismissal, installs are no longer available to cancel
        let notifications = browser.popupNotifications;
        if (!notifications)
          return;
    
        var index = notifications.indexOf(this);
        if (index == -1)
          return;
    
        // remove the notification
        notifications.splice(index, 1);
      },
      removeOnDismissal: false,
      installs: aInstalls
    };

    // message is ignored and will be handled in the overridden XBL.
    let notification = chromeWin.PopupNotifications.show(browser,
                                                         "addon-install-downloaded",
                                                         "<ignored>",
                                                         "addons-notification-icon",
                                                         mainAction, null, options);
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([XPInstallPrompt]);
