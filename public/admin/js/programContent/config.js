import edit_button from '../edit_button.html';

export default function (nga, admin) {
    const programContent = admin.getEntity('program_content');

    programContent.listView()
        .title('<h4>Program Content <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
        .listActions(['edit', 'delete'])
        .batchActions([])
        .fields([
            nga.field('id')
                .label('ID'),
            nga.field('title')
                .label('Title'),
            nga.field('channel_id', 'reference')
                .targetEntity(admin.getEntity('Channels'))
                .targetField(nga.field('title'))
                .remoteComplete(true, {
                    refreshDelay: 300,
                    searchQuery: function (search) {
                        return {q: search};
                    }
                })
                .label('Channel'),
            nga.field('icon_url', 'file')
                .template(`<div ng-controller="modalController">
                     <img ng-src="{{ entry.values.icon_url }}"
                     width="45"
                     height="45"
                     ng-click="openModalImage(entry.values.icon_url, 'thumbnail')">
                     </div>`)
                .label('Image')
        ])
        .filters([
            nga.field('q')
                .label('')
                .template('<div class="input-group"><input type="text" ng-model="value" placeholder="Search" class="form-control"><span class="input-group-addon"><i class="glyphicon glyphicon-search"></i></span></div>')
                .pinned(true),
            nga.field('channel_id', 'reference')
                .targetEntity(admin.getEntity('Channels'))
                .targetField(nga.field('title'))
                .remoteComplete(true, {
                    refreshDelay: 300,
                    searchQuery: function (search) {
                        return {q: search};
                    }
                })
                .label('Search for Channel Name'),
        ])

    programContent.creationView()
        .title('<h4>Program Content <i class="fa fa-angle-right" aria-hidden="true"></i> Create</h4>')
        .fields([
            nga.field('title')
                .label('Program Name'),
            nga.field('channel_id', 'reference')
                .targetEntity(admin.getEntity('Channels'))
                .targetField(nga.field('title'))
                .remoteComplete(true, {
                    refreshDelay: 300,
                    searchQuery: function (search) {
                        return {q: search};
                    }
                })
                .label('Channel'),
            nga.field('icon_url', 'file')
                .uploadInformation({'url': '/file-upload/single-file/programContent/image_url', 'apifilename': 'result'})
                .template('<div class="row">' +
                    '<div class="col-xs-12 col-sm-1"><img src="{{ entry.values.icon_url }}" height="40" width="40" /></div>' +
                    '<div class="col-xs-12 col-sm-8"><ma-file-field field="field" value="entry.values.icon_url"></ma-file-field></div>' +
                    '</div>' +
                    '<div class="row"><small id="emailHelp" class="form-text text-muted">not larger than 250 KB</small></div>')
                .validation({
                    validator: function (value) {
                        if (value == null) {
                            throw new Error('Please, choose icon');
                        } else {
                            var icon_url = document.getElementById('icon_url');
                            if (icon_url.value.length > 0) {
                                if (icon_url.files[0].size > 250000) {
                                    throw new Error('Your Icon is too Big, not larger than 250 KB');
                                }
                            }
                        }
                    }
                })
                .label('Image *'),
            nga.field('template')
                .label('')
                .template(edit_button)
        ]);


    programContent.editionView()
        .actions(['list'])
        .title('<h4>Program Content <i class="fa fa-angle-right" aria-hidden="true"></i> Edit: {{ entry.values.id }}</h4>')
        .fields([
            programContent.creationView().fields()
        ]);

    programContent.deletionView()
        .title('<h4>Program Content <i class="fa fa-angle-right" aria-hidden="true"></i> Remove <span style ="color:red;"> {{ entry.values.id }}')
        .actions(['<ma-back-button entry="entry" entity="entity"></ma-back-button>'])

    return programContent;

}
