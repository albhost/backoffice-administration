function editChannels(Restangular, $uibModal, $q, notification, $state, $http) {
    'use strict';

    return {
        restrict: 'E',
        scope: {post: '&'},
        link: function (scope, element, attrs) {
            //icon
            scope.icon = 'fa fa-ban fa-md';

            //label
            if (attrs.type === 'editChannels') scope.label = 'Edit Channels';
            if (scope.post().values.id >= 3) scope.hide = 'none';

            scope.modal = function () {
                $uibModal.open({
                    template:
                    // '<script src="angularjs-dropdown-multiselect.min.js"></script>\n' +
                        '<div class="modal-header">' +
                        '<h5 class="modal-title" style="font-weight: bold;font-size: 20px;">Edit Channels</h5>' +
                        '</div>' +
                        '<div class="modal-body">' +
                        '<div class="row">' +
                        '<form>' +
                        '<div class="form-group" style="padding: 20px;">' +

                        '<input style="display:none" type="text" id="id" class="form-control" placeholder="Carousel Type ID" value="{{id}}" disabled><br /> ' +

                        '<input type="text" id="type" class="form-control" placeholder="type" value="{{type}}" disabled>' +
                        '</div>' +
                        '<div style="padding: 20px;">' +
                        '<div ng-dropdown-multiselect="" id="title" options="channel_data" selected-model="model" checkboxes="true" extra-settings="setting"></div>' +
                        '</div>' +
                        '</form>' +
                        '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                        '<button class="btn btn-primary" type="button" ng-click="ok()">OK</button>' +
                        '<button class="btn btn-warning" type="button" ng-click="cancel()">Cancel</button>' +
                        '</div>' +
                        '</head>\n' +
                        '\n' +
                        '<body ng-controller="MainCtrl">\n' +
                        '  <pre>Channels: {{model}} </pre>',


                    controller: ('main', ['$scope', '$uibModalInstance', function ($scope, $uibModalInstance) {
                        function closeModal() {
                            $uibModalInstance.dismiss();
                        }

                        $scope.cancel = function () {
                            closeModal();
                        };

                        $scope.setting = {
                            scrollableHeight: '400px',
                            scrollable: true,
                            enableSearch: true
                        };

                        var groups_array = [];
                        $http.get('../api/channels').then(function (response) {
                            var data = response.data;
                            for (var i = 0; i < data.length; i++) {
                                groups_array.push({id: data[i].id, label: data[i].title})
                            }

                        }, function errorCallback(response) {
                            notification.log(response.statusText, {addnCls: 'humane-flatty-error'});
                        });


                        $scope.model = []
                        $scope.channel_data = groups_array;


                        //populate title from Administration Panel
                        $scope.type = scope.post().values.type;
                        $scope.title = groups_array;
                        $scope.id = scope.post().values.id;

                        const id = $scope.id;
                        $http.get("../api/carousels/channels/" + id).then(function (response) {
                            $scope.model = response.data;
                        }, function errorCallback(response) {
                            notification.log(response.statusText, {addnCls: 'humane-flatty-error'});
                        });


                        //When OK button is clicked
                        $scope.ok = function () {
                            let type = document.getElementById('type').value,
                                title = document.getElementById('title').value,
                                id = document.getElementById('id').value;

                            var channels_list = [];
                            for (var j = 0; j < $scope.model.length; j++) {
                                channels_list.push($scope.model[j].id);
                            }

                            var data = {
                                "id": parseInt(id),
                                "carousel_type": type,
                                "channel_id": channels_list
                            };

                            $http.post("../api/carousels/channels/" + id, data).then(function successCallback(response) {
                                closeModal();
                                notification.log('Channels successfully added', {addnCls: 'humane-flatty-success'});

                            }, function errorCallback(response) {
                                notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
                            });
                        };
                    }])
                })
            }
        },

        template: '<a style="display: {{hide}};" class="btn btn-default btn-xs" ng-click="modal()"><span class="{{ icon }}" aria-hidden="true"></span>&nbsp;{{ label }}</a>'
    };
}

editChannels.$inject = ['Restangular', '$uibModal', '$q', 'notification', '$state', '$http'];

export default editChannels;