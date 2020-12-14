function remove(Restangular, $uibModal, $q, notification, $state,$http) {
    'use strict';

    return {
        restrict: 'E',
        scope: {
            selection: '=',
            type: '@',
            ngConfirmMessage: '@',
            ngConfirm: '&'
        },
        link: function(scope, element, attrs) {


            scope.myFunction = function(){
                var spanDropdown = document.querySelectorAll('span.btn-group')[0];
                spanDropdown.classList.add("open");
            };

            scope.icon = 'glyphicon-list';
            if (attrs.type == 'remove_devices') scope.button = 'Remove Devices';
            var years = [];

            $http.get('../api/deleteByYear').then(function(response) {
                var data = response.data.response_object;
                for(var i=0;i<data.length;i++){
                    years.push({id:data[i]})
                }
            });


            scope.years = years;

            scope.removeByYears = function () {
                scope.change = function(id) {
                    scope.button = id;
                    var older_than_years = id;
                    $http.delete('../api/devices/delete-old', {params: {older_than_years: older_than_years}}).then(function (response,data, status, headers, config,file) {
                        notification.log('Devices Successfully Deleted ', { addnCls: 'humane-flatty-success' });
                    },function (data, status, headers, config) {
                        notification.log('Something Wrong', { addnCls: 'humane-flatty-error' });
                    })

                }


        }
        },
        template: '<div class="btn-group" uib-dropdown is-open="status.isopen"> ' +
            '<button ng-click="myFunction()" id="single-button" type="button" class="btn btn-default" uib-dropdown-toggle ng-disabled="disabled">' +
            '<span class="glyphicon {{icon}}"></span> {{button}} <span class="caret"></span>' +
            '</button>' +
            '<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="single-button">' +
            '<li role="menuitem" ng-click="change(choice.id)"  ng-repeat="choice in years">' +
            '<p id="paragraph_vod" ng-click="removeByYears()">{{choice.id}}</p>' +
            '</li>' +
            '</ul>' +
            '</div>'
    };
}

remove.$inject = ['Restangular', '$uibModal', '$q', 'notification', '$state','$http'];

export default remove;