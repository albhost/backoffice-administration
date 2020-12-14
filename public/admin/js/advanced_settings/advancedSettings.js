import Template from './advancedSettings.html';

function advancedsettings($stateProvider) {
  $stateProvider.state('advancedSettings', {
    parent: 'main',
    url: '/AdvancedSettings',
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },
    controller: ['$http', '$scope', 'notification', function ($http, $scope, notification) {
      const token = localStorage.userToken || "";
      const getConfig = {
        method: 'GET',
        url: '../api/AdvancedSettings',
        headers: {'Authorization': token}
      };


      $http(getConfig).then(function successCallback(response) {
        if (response.status === 200) {
          $scope.advanced_settings = {
            akamai: response.data.akamai,
            auth: response.data.auth,
            flussonic: response.data.flussonic,
            nimble_drm: response.data.nimble_drm,
            nimble_token: response.data.nimble_token,
            stripe: response.data.stripe,
            verizon: response.data.verizon,
            vod: response.data.vod,
            paypal: response.data.paypal,
            wowza: response.data.wowza,
            woocomerce: response.data.woocomerce,
            default_player: response.data.default_player,
            client_app: {
              ...response.data.client_app,
              blacklist: response.data.client_app.blacklist.join(",")
            },
              public_api: {
                ...response.data.public_api,
                  ip_whitelist: response.data.public_api.auth.ip_whitelist

              },
              elastic_stack: response.data.elastic_stack,
              google_cloud: response.data.google_cloud,
              vmx:response.data.vmx,
            akamai_segment_media: response.data.akamai_segment_media,
            widevine: response.data.widevine,
          }

        }
    }, function errorCallback(response) {
      if (response.status === 400) {
        notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
      } else {
        notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
      }
    });

  $scope.updateAdvancedSettings = function () {
    const blacklist = $scope.advanced_settings.client_app.blacklist.replace(/\s/g, '').split(",");
    let blackListUpdateArray = [];
    for(let i = 0; i < blacklist.length; i++) {
      if(blacklist[i] === "") continue;

      if(!blacklist[i].match(/^(\d+\.)?(\d+\.)?(\*|\d+)$/g)) {
        notification.log("Invalid version entered", {addnCls: 'humane-flatty-error'});
        return;
      }

      blackListUpdateArray.push(blacklist[i]);
    }

    const config = {
      method: 'PUT',
      url: '../api/AdvancedSettings',
      headers: {'Authorization': token},
      data: {
        ...$scope.advanced_settings, client_app: {
          ...$scope.advanced_settings.client_app,
          blacklist: blackListUpdateArray
        }
      }
    };

    $http(config).then(function successCallback(response) {
      if (response.status === 200) {
        notification.log('Update Successfully', {addnCls: 'humane-flatty-success'});
      }
    }, function errorCallback(response) {
      if (response.status === 400) {
        notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
      } else {
        notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
      }
    });
  }
}

],
template: Template
})
;
}

advancedsettings.$inject = ['$stateProvider'];

export default advancedsettings;
