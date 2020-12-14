import edit_button from '../edit_button.html';

export default function (nga, admin) {
  const streamsServer = admin.getEntity('streams_server');
  streamsServer.listView()
    .title('<h4>Streams Server <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
    .batchActions([])
    .fields([
      nga.field('server_address', 'string')
        .label('Server Address'),
      nga.field('base_url', 'string')
        .label('Base URL'),
      nga.field('connections_threshold', 'string')
        .label('Connections Threshold'),
      nga.field('out_rate_threshold', 'string')
        .label('Out Rate Threshold'),
      nga.field('connection', 'string')
        .label('Current Connections'),
      nga.field('out_rate', 'string')
        .label('Current Out Rate'),
      nga.field('connection_status', 'string')
        .label('Connection Status'),
      nga.field('is_available', 'boolean')
        .label('Is Available'),
      nga.field('last_update', 'datetime')
        .label('Last Update'),
    ])
    .listActions(['edit'])
    .exportFields([
      streamsServer.listView().fields(),
    ]);


  streamsServer.creationView()
    .title('<h4>Streams Server <i class="fa fa-angle-right" aria-hidden="true"></i> Create: Streams Server</h4>')
    .fields([
      nga.field('server_address', 'string')
        .attributes({placeholder: 'Server Address'})
        .validation({required: true})
        .label('Server Address'),
      nga.field('api_key', 'string')
        .attributes({placeholder: 'API Key'})
        .validation({required: false})
        .label('API Key'),
      nga.field('client_key', 'string')
        .attributes({placeholder: 'Client Key'})
        .validation({required: false})
        .label('Client Key'),
      nga.field('base_url', 'string')
        .attributes({placeholder: 'Base URL'})
        .validation({required: true})
        .label('Base URL'),
      nga.field('connections_threshold', 'number')
        .attributes({placeholder: 'Connections Threshold'})
        .validation({required: true})
        .label('Connections Threshold'),
      nga.field('out_rate_threshold', 'number')
        .attributes({placeholder: 'Out Rate Threshold'})
        .validation({required: true})
        .label('Out Rate Threshold'),
      nga.field('is_available', 'boolean')
        .validation({ required: true })
        .defaultValue(true)
        .label('Is Available'),
      nga.field('template')
        .label('')
        .template(edit_button),
    ]);

  streamsServer.editionView()
    .title('<h4>Streams Server <i class="fa fa-angle-right" aria-hidden="true"></i> Edit: {{ entry.values.id }}</h4>')
    .actions(['list', 'delete'])
    .fields([
      streamsServer.creationView().fields(),
    ]);


  return streamsServer;

}