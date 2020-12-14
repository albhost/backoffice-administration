import Template from './activeDevicesChart.html'

export default function ($stateProvider) {
  $stateProvider.state('reports/active_devices', {
    parent: 'main',
    url: '/activeDevicesChart',
    params: {},

    controller: function (Restangular, $scope, VisDataSet, notification) {

      Restangular.all('reports/active_devices')
        .getList()
        .then(function (response) {
          if (response.data)
            var res = response.data;
          else
            var res = response;

          $scope.options = {
            style: 'bar',
            barChart: {width: 60, align: 'center'}, // align: left, center, right
            drawPoints: {
              onRender: function (item, group, grap2d) {
                return item.label != null;
              }
            },
            shaded: {
              orientation: 'bottom' // top, bottom
            },
            dataAxis: {
              icons: true
            },
            orientation: 'top',
            start: res[0].date ? res[0].date : new Date().setDate(
              new Date().getDate() - 400
            ),
            end: new Date(),
            zoomable: true
          };
          const mapData = (items, id) => {
            return items.map(item => {
              if (item.appid === id) {
                return {
                  x: new Date(item.date).setDate(15),
                  y: item.total,
                  label: {
                    content: item.total,
                    className: "graph-blue",
                    xOffset: 0,
                    yOffset: -7
                  }
                }
              } else return {x: 0, y: 0}
            })
          };
          $scope.active_devices_chart_1 = {
            items: mapData(res, 1)
          };
          $scope.active_devices_chart_2 = {
            items: mapData(res, 2)
          };
          $scope.active_devices_chart_3 = {
            items: mapData(res, 3)
          };
          $scope.active_devices_chart_4 = {
            items: mapData(res, 4)
          };
          $scope.active_devices_chart_6 = {
            items: mapData(res, 6)
          };
          $scope.active_devices_chart_7 = {
            items: mapData(res, 7)
          };
          $scope.active_devices_chart_8 = {
            items: mapData(res, 8)
          };
            $scope.active_devices_chart_9 = {
                items: mapData(res, 9)
            };
        })
        .catch(err => {
          winston.error("Failed to fetch data from endpoint /reports/active_devices, error: ", err);
          notification.log(err, {addnCls: 'humane-flatty-error'});
        })
    },

    template: Template
  })
}
