import edit_button from '../edit_button.html';
import filter_genre_btn from '../filter_genre_btn.html';

export default function (nga, admin) {
    var notification = admin.getEntity('notification');
    notification.listView()
        .title('<h4>Subscription Message <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
        .fields([
            nga.field('username')
                .label('Username'),
            nga.field('googleappid')
                .label('Device'),
            nga.field('title')
                .label('Title'),
            nga.field('message')
                .map(function truncate(value) {
                    if (!value) {
                        return '';
                    }
                    return value.length > 14 ? value.substr(0, 14) + '...' : value;
                })
                .label('Messages'),
            nga.field('createdAt', 'datetime')
                .label('Time sent')
        ])
        .listActions([]);

    notification.creationView()
        .title('<h4>Subsription <i class="fa fa-angle-right" aria-hidden="true"></i> Send: Subscription message</h4>')
        .onSubmitSuccess(['progression', 'notification', '$state', 'entry', 'entity', function(progression, notification, $state, entry, entity) {
            notification.log(`Notification send successfully`, { addnCls: 'humane-flatty-success' });
            // redirect to the list view
            $state.go($state.current, {}, {reload : true})
                .then($state.go($state.get('list'), { entity: entity.name() })); // cancel the default action (redirect to the edition view)
            return false;
        }])
        .fields([

                nga.field('usertype', 'choice')
                    .choices(function (entry) {
                        var types = [
                            { value: 'one', label: 'One User' },
                            { value: 'all', label: 'All User' }
                        ]
                        return types;
                    })
                    .label('User Type'),

            nga.field('username', 'reference')
                .targetEntity(admin.getEntity('LoginData'))
                .targetField(nga.field('username'))
                .attributes({ placeholder: 'Select Account from dropdown list' })
                .remoteComplete(true, {
                    refreshDelay: 300,
                    // populate choices from the response of GET /posts?q=XXX
                    searchQuery: function(search) { return { q: search }; }
                })
                .perPage(10) // limit the number of results to 10
                .label('Username'),
            nga.field('appid', 'choices')
                .attributes({ placeholder: 'Select from dropdown list to send to device type:' })
                .choices([
                    { value: 1, label: 'Android Set Top Box' },
                    { value: 2, label: 'Android Smart Phone' },
                    { value: 3, label: 'IOS' },
                    { value: 4, label: 'Android Smart TV' },
                    { value: 5, label: 'Samsung Smart TV' },
                    { value: 6, label: 'Apple TV' },
                  {value: 7, label: 'Web Smart TV'},
                  {value: 8, label: 'Web App'},
                    {value: 9, label: 'Roku TV'}
                ])
                .validation({required: true})
                .label('Applications IDs'),

          nga.field('type', 'choice')
            .choices([
              { value: 'textonly', label: 'Text Only' },
              { value: 'imageonly', label: 'Image only' },
              { value: 'imageandtext', label: 'Image and Text' }
            ])
            .validation({required: true})
            .attributes({ placeholder: 'Select from dropdown list filter values' })
            .label('Ad Type'),

            nga.field('title', 'string')
                .attributes({ placeholder: 'Title' })
                .label('Title'),
            nga.field('message', 'text')
                .attributes({ placeholder: 'Message' })
                .label('Message'),
            nga.field('link_url', 'string')
                .template('<ma-input-field field="field" value="entry.values.link_url"></ma-input-field>'+
                    '<small id="emailHelp" class="form-text text-muted">Default empty string</small>')
                .label('Link'),
            nga.field('imageGif', 'string')
                .attributes({ placeholder: 'Image link' })
                .label('Image link'),
            nga.field('duration', 'number')
                .template('<div>'+
                    '<ma-input-field field="field" value="entry.values.duration"></ma-input-field>'+
                    '<small id="emailHelp" class="form-text text-muted">Ad duration. Default 5000 ms</small>'+
                    '</div>')
                .attributes({ placeholder: 'Duration in ms' })
                .label('Duration in ms'),
            nga.field('delivery_time', 'datetime')
                .attributes({ placeholder: 'Choose date' })
                .label('Send ad at'),

            nga.field('template')
                .label('')
                .template(edit_button),
        ]);
    return notification;

}