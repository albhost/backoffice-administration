
function bulkUpload(Restangular, $uibModal, $q, notification, $state,$http) {
    'use strict';

    return {
        restrict: 'E',
        scope: {
            selection: '=',
            type: '@',
            ngConfirmMessage: '@',
            ngConfirm: '&'
        },
        link:  function (scope, attrs, element) {


            if (attrs.type === 'bulkUpload')
                scope.label = 'Upload Image';
            scope.uploaded = false;

            scope.onFileSelect = function ($files) {
                if (!$files || !$files.length) return;
                scope.file = $files[0];
            };

            scope.upload = function () {
                if (!scope.file) return;


                var URL = '/file-upload/single-file/programContent/icon_url';

                var fd = new FormData();
                fd.append('file',scope.file);
                return $http.post(URL, fd, {
                    transformRequest: angular.identity,
                    headers: { 'Content-Type': undefined }
                })
                    .then(function (res) {
                        var data = {'value': scope.selection, 'data': res.data};
                        $http.post("../api/bulkUpload", data).then(function successCallback(response) {
                            scope.file = null;
                            $state.reload();
                            notification.log(res.data.error || "Image uploaded", { addnCls: 'humane-flatty-success' });

                        }, function errorCallback(response) {
                            notification.log(response.data.message, {addnCls: 'humane-flatty-error'});
                        });

                    })
                    .catch(function (res) {
                        notification.log(res.data.error || "Could not upload", { addnCls: 'humane-flatty-error' });
                    });
            };
        },
        template: `<div class="row">
				<style>
					.uploader {
						color: #333;
						background-color: #f7f7f7;
						display: inline-block;
						margin-bottom: 0;
						font-weight: 400;
						text-align: center;
						vertical-align: middle;
						touch-action: manipulation;
						background-image: none;
						cursor: pointer;
						border: 1px dashed #ccc;
						white-space: nowrap;
						padding: 24px 48px;
						font-size: 14px;
						line-height: 1.42857;
						border-radius: 4px;
						-webkit-user-select: none;
						-moz-user-select: none;
						-ms-user-select: none;
						user-select: none;
					}
					.uploader.bg-success {
						background-color: #dff0d8;
					}
					.uploader.bg-danger {
						background-color: #f2dede;
					}
				</style>
				<div class="col-md-4" ng-hide="file">
					<div class="uploader"
						ngf-drop
						ngf-select
						ngf-drag-over-class="{pattern: 'image/*', accept:'bg-success', reject:'bg-danger', delay:50}"
						ngf-pattern="image/*"
						ngf-max-total-size="'1MB'"
						ngf-change="onFileSelect($files)"
						ngf-multiple="false">Select an image or drop it here</div>
				</div>
				<div class="col-md-4" ng-show="file">
					<button type="button" class="btn btn-primary" ng-click="upload()">
						<span class="glyphicon glyphicon-upload"></span> Upload the image
					</button>
				</div>
		</div>`
    };
};

bulkUpload.$inject = ['Restangular', '$uibModal', '$q', 'notification', '$state','$http'];

export default bulkUpload;