var fa = {
	clientId:null,
	redirectUri:"https://login.salesforce.com/services/oauth2/success",
	oauthData:null,
	authenticated:false,
	loginUrl:"https://login.salesforce.com",
	refreshToken:null,
	accessToken:null,
	apiVersion:"22.0",
	instanceUrl:null,
	id:null,
	issuedAt:null,
	signature:null,
	rest:null,
	usePostBin:false,
	
	win:Titanium.UI.createWindow()
	
	,
	
	open : function(clientId, redirectUri, apiVersion) {

		Ti.API.debug("Client Id in ForceOAuth.Open is: " + clientId);
		Ti.API.debug("Login Url: " + fa.loginUrl);
		fa.clientId = clientId;
		if (redirectUri) fa.redirectUri = redirectUri;
		if (apiVersion) fa.apiVersion = apiVersion;

		var odataString = Ti.App.Properties.getString("oauthData_preference");
		Titanium.API.info("OAuth Data String: " + odataString);
		//if (odataString.length == 0) odataString = null;

		if (odataString === null)
			fa.accessToken = null;
		else if (odataString.length == 0) {
			fa.accessToken = null;
			odataString = null;
		} else 
			fa.setOAuthData(JSON.parse(odataString));

		if (fa.accessToken !== null) {
			Ti.API.info("Calling oauth success event..." + fa.instanceUrl);
			setTimeout(function() {
				fa.authenticated = true;
				Ti.App.fireEvent('OAuthSuccess', {"baseUrl":fa.instanceUrl});		
			}, 100);
		} else {

		    var webview = Ti.UI.createWebView();
		    var oauthURL = fa.loginUrl + "/services/oauth2/authorize?response_type=token&" +
		        "client_id=" + fa.clientId + "&redirect_uri=" + fa.redirectUri + "&display=touch";

		    webview.url = oauthURL;

		    fa.win.add(webview)
		    fa.win.open();

			webview.addEventListener('load', function(e) 
			{
				if (e.url.indexOf("https://login.salesforce.com/services/oauth2/success") == 0) {
					fa.pullOAuthData(e.url.split("#")[1]);
					fa.win.remove(webview);
					fa.win.close();
					fa.authenticated = true;
					Ti.App.fireEvent('OAuthSuccess', {"baseUrl":fa.instanceUrl});
				}
			});
		}
	}
	
	,
	
	pullOAuthData : function(dataParams) {
		Ti.API.debug("oauth data params = " + dataParams);
		var kvPairs = dataParams.split("&");
		var oauthString = "{";
		for (var i=0;i<kvPairs.length;i++) {
			var kv = kvPairs[i].split("=");
			oauthString += "\"" + kv[0] + "\":\"" + kv[1] + "\"";
			if (i < kvPairs.length - 1) {
				oauthString += ", ";
			}
			Ti.API.info("key: " + kv[0] + ", value: " + kv[1]);
		}
		oauthString += "}";
		Ti.API.debug("Data 2: " + oauthString);
		this.setOAuthData(JSON.parse(oauthString));
		Ti.App.Properties.setString("oauthData_preference", oauthString);		
	}
	
	,
	
	setOAuthData : function(oauthdata) {
		Ti.App.Properties.setString("accessToken_preference", oauthdata["access_token"]);
		fa.accessToken = oauthdata["access_token"];
		Ti.App.Properties.setString("refreshToken_preference", oauthdata["refresh_token"]);
		fa.refreshToken = oauthdata["refresh_token"];
		fa.instanceUrl = oauthdata["instance_url"];
		fa.id = oauthdata["id"];
		fa.issuedAt = oauthdata["issued_at"];
		fa.signature = oauthdata["signature"];
	}
	
	,
	
	refreshAccessToken:function(callback, error) {
		Ti.API.debug("Got to the refreshAccessToken function...");
	   	var xhr = Titanium.Network.createHTTPClient();
	   	
		xhr.onload = function() {
			Ti.API.debug(xhr.responseData);
			var jsonResponse = JSON.parse(xhr.responseData);
			jsonResponse["refresh_token"] = fa.refreshToken;
			fa.setOAuthData(jsonResponse);
			callback(xhr.responseData);
		};
		
		xhr.onerror = function(e) { 
			Ti.API.info("ERROR " + e.error); 
			alert(e.error); 
		 }; 
	 	
		var turl = "http://www.postbin.org/zu59sx";
	    var url = fa.loginUrl + '/services/oauth2/token';
		
		Ti.API.debug("Refresh token url: " + url);
		
		xhr.open("POST", url);
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		
		Ti.API.debug("Grant: " + 'grant_type=refresh_token&client_id=' + fa.clientId + '&refresh_token=' + fa.refreshToken + "\n\nURL: " + url);
		
		xhr.send( 'grant_type=refresh_token&client_id=' + fa.clientId + '&refresh_token=' + fa.refreshToken );
	}
	,
	makeRestCall : function(path, callback, error, method, payload, retry) {
		var restUrl = Titanium.Network.decodeURIComponent(fa.instanceUrl) + '/services/data' + path;
	
		var xhr = Titanium.Network.createHTTPClient();
	
		xhr.onload = function() {  
			Titanium.API.info("REST Response: " + this.responseText);
			if (!this.responseText) {
				callback("");
			} else {
				var data = JSON.parse(this.responseText);
			}
			callback(data);
		};
	
		xhr.onerror = function(e) { 
			Titanium.API.error("XHR, error handler..." + 
				"\nDbDotCom.REST.OAuth.refreshToken: " + fa.refreshToken + 
				"\nretry: " + retry +
				"\n e: " + e.error +
				"\nXHR status: " + this.status);
			if (!fa.refreshToken || retry)  {
				error(e.error);
			} else {
				Titanium.API.error("In the error handler looking for a 401, and have a " + xhr.status);
        		if (xhr.status === 401) {
					Titanium.API.error("Handleing the 401 error...");
            		exports.refreshAccessToken(function(oauthResponse) {
                		Ti.API.error("Refresh response... " + oauthResponse);
                		fa.makeRestCall(path, callback, error, method, payload, true);
                	}, error);
				} else {
					Titanium.API.error("Not a 401 error, re-throwing...");
            		error(e);
				}
			}
		};
	
		if (fa.usePostBin === true) {
			restUrl = "http://www.postbin.org/135onm5";
		}
		xhr.open(method || "GET", restUrl, true)
	
		Titanium.API.info("Rest url: " + restUrl);
	
		xhr.setRequestHeader("Authorization", "OAuth " + Titanium.Network.decodeURIComponent(fa.accessToken));
		xhr.setRequestHeader("Content-Type", "application/json");
	
		xhr.send(payload);
	},

    setRefreshToken : function(refreshToken) {
        fa.refreshToken = refreshToken;
    }
	,
    refreshAccessToken : function(callback, error) {
    	fa.refreshAccessToken(callback, error);
    }
	,
    versions : function(callback, error) {
        fa.makeRestCall('.json', callback, error);
    }
	,
    resources : function(callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/', callback, error);
    }
	,
    describeGlobal : function(callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/', callback, error);
    }
	,
    metadata : function(objtype, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/'
        , callback, error);
    }
	,
    describe : function(objtype, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype
        + '/describe/', callback, error);
    }
	,
    create : function(objtype, fields, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype
        , callback, error, "POST", JSON.stringify(fields));
    }
	,
    retrieve : function(objtype, id, fieldlist, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        + '?fields=' + fieldlist, callback, error);
    }
	,
    update : function(objtype, id, fields, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        , callback, error, "PATCH", JSON.stringify(fields));
    }
	,
    del : function(objtype, id, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/sobjects/' + objtype + '/' + id
        , callback, error, "DELETE");
    }
	,
    query : function(soql, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/query/?q=' + escape(soql)
        , callback, error, "GET");
    }
	,
    search : function(sosl, callback, error) {
        fa.makeRestCall('/v' + fa.apiVersion + '/search/?q=' + escape(sosl)
        , callback, error);
    }
    ,
    recordFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/record/' + recordId + '/feed-items', 
    		callback, error);
    }
	,
    newsFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/news/' + recordId + '/feed-items', 
    		callback, error);
    }
	,
    profileFeed : function(recordId, callback, error) {
    	fa.makeRestCall('/v' + fa.apiVersion + '/chatter/feeds/user-profile/' + recordId + '/feed-items', 
    		callback, error);
    }
};

exports.ForceOAuth = fa;












