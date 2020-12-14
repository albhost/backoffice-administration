import Template from '../allActiveDevicesChart/allActiveDevicesChart.html'

export default function ($stateProvider) {
    $stateProvider.state('reports/all_active_devices', {
        parent: 'main',
        url: '/allActiveDevicesChart',
        params: {},

        controller: function (Restangular, $scope, VisDataSet, notification) {
            $scope.deviceController = function () {
                Restangular.all('reports/all_active_devices')
                    .getList()
                    .then(function (res) {

                        if (res.data)

                            var result = res.data;
                        else
                            var result = res;

                        $scope.options = {
                            style: 'bar',
                            barChart: {width: 60, align: 'center'},
                            drawPoints: {
                                onRender: function (item, group, grap2d) {
                                    return item.label != null;
                                }
                            },
                            shaded: {
                                orientation: 'bottom'
                            },
                            dataAxis: {
                                icons: true
                            },
                            orientation: 'top',
                            start: result[0].appid,
                            end: result[5].appid,
                            zoomable: true
                        };

                        const mapDeviceData = (values) => {
                            return values.map(value => {
                                return {
                                    x: value.appid,
                                    y: value.total,
                                    label: {
                                        content: value.total,
                                        className: "graph-blue",
                                        xOffset: 0,
                                        yOffset: -7
                                    }
                                }
                            })
                        };
                        $scope.active_devices_chart = {
                            items: mapDeviceData(result)
                        };

                    })
                    .catch(err => {
                        notification.log(err, {addnCls: 'humane-flatty-error'});
                    })
            }
        },

        template: Template
    })
}
