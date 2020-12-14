import edit_button from '../edit_button.html';

export default function (nga, admin) {
	var vodstream = admin.getEntity('vodstreams');
	vodstream.listView()
		.title('<h4>Vod Streams <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
		.batchActions([])
		.fields([
			nga.field('vod_id', 'reference')
				.targetEntity(admin.getEntity('Vods'))
                .targetField(nga.field('title'))
                .isDetailLink(false)
				.label('Vod'),
			nga.field('stream_source_id', 'reference')
				.targetEntity(admin.getEntity('VodStreamSources'))
                .targetField(nga.field('description'))
                .isDetailLink(false)
				.label('Stream Source'),
			nga.field('url', 'string')
				.label('Url'),
            nga.field('stream_type', 'string')
                .label('Stream Type'),
            nga.field('token', 'boolean')
				.label('Token'),
/*			nga.field('encryption', 'boolean')
				.label('Encryption'),*/
			nga.field('token_url', 'string')
				.label('Token Url'),
		])
		.listActions(['edit'])
		.exportFields([
         vodstream.listView().fields(),
        ]);

    vodstream.deletionView()
        .title('<h4>Vod Streams <i class="fa fa-angle-right" aria-hidden="true"></i> Remove <span style ="color:red;"> Vod Streams')
        .actions(['<ma-back-button entry="entry" entity="entity"></ma-back-button>'])

    vodstream.creationView()
        .title('<h4>Vod Streams <i class="fa fa-angle-right" aria-hidden="true"></i> Create: Vod Stream</h4>')
        .onSubmitSuccess(['progression', 'notification', '$state', 'entry', 'entity', function(progression, notification, $state, entry, entity) {
            progression.done();
            $state.go($state.get('edit'), { entity: 'Vods', id: entry.values.vod_id });
            return false;
        }])
        .fields([
            nga.field('vod_id', 'reference')
                .targetEntity(admin.getEntity('Vods'))
                .targetField(nga.field('title'))
                .attributes({ placeholder: 'Choose from dropdown list VOD Movie' })
                .validation({validator: function(value) {
                        if(value === null || value === ''){
                            throw new Error('Please Select Vod');
                        }
                    }
                })
                .perPage(-1)
                .label('Vod *'),
            nga.field('stream_source_id', 'reference')
                .targetEntity(admin.getEntity('VodStreamSources'))
                .targetField(nga.field('description'))
                .attributes({ placeholder: 'Stream Source' })
                .validation({validator: function(value) {
                        if(value === null || value === ''){
                            throw new Error('Please Select Stream Source');
                        }
                    }
                })
                .perPage(-1)
                .label('Stream Source *'),
            nga.field('url', 'string')
                .attributes({ placeholder: 'Movie Stream Url' })
                .label('Url *'),
            // nga.field('stream_mode', 'choice')
            //     .attributes({ placeholder: 'Select Stream Mode from dropdown list' })
            //     .choices([
            //         { value: 'hls', label: 'hls' },
            //         { value: 'mpegd', label: 'mpegd' }
            //     ])
            //     .validation({validator: function(value) {
            //             if(value === null || value === ''){
            //                 throw new Error('Please Select Stream mode');
            //             }
            //         }
            //     })
            //     .label('Stream Type *'),
            // nga.field('stream_type', 'choice')
            //     .attributes({ placeholder: 'Select Stream Type from dropdown list' })
            //     .choices([
            //         { value: 'vr', label: 'vr' },
            //         { value: '360', label: '360' }
            //     ])
            //     .validation({validator: function(value) {
            //             if(value === null || value === ''){
            //                 throw new Error('Please Select Stream type');
            //             }
            //         }
            //     })
            //
            //     .label('Stream Type *'),
            nga.field('stream_resolution', 'choices')
                .attributes({ placeholder: 'Select screen types where this stream should play' })
                .choices([
                    { value: 1, label: '1 - Android Set Top Box' },
                    { value: 2, label: '2 - Android Smart Phone' },
                    { value: 3, label: '3 - IOS' },
                    { value: 4, label: '4 - Android Smart TV' },
                    { value: 5, label: '5 - Samsung Smart TV' },
                    { value: 6, label: '6 - Apple TV' },
                  {value: 7, label: '7 - Web Smart TV'},
                  {value: 8, label: '8 - Web App'},
                    {value: 9, label: '9 - Roku TV'}
                ])
                .defaultValue([1,2,3,4,5,6,7,8,9])
                .validation({validator: function(value) {
                    if(value === null || value === ''){
                        throw new Error('Please Select Stream resolution');
                    }
                }
                })
                .label('Stream resolution *'),
            nga.field('stream_format', 'choice')
                .attributes({ placeholder: 'Stream Format' })
                .choices([
                    { value: 0, label: 'MPEG Dash' },
                    { value: 1, label: 'Smooth Streaming' },
                    { value: 2, label: 'HLS' },
                    { value: 3, label: 'OTHER' }
                ])
                .validation({validator: function(value) {
                        if(value === null || value === ''){
                            throw new Error('Please Select Stream Format');
                        }
                    }
                })
                .label('Stream Format *'),

            // nga.field('stream_mode', 'choice')
            //     .attributes({ placeholder: 'Select Stream Mode from dropdown list' })
            //     .choices([
            //         { value: 'hls', label: 'hls' },
            //         { value: 'mpegd', label: 'mpegd' }
            //     ])
            //     .validation({validator: function(value) {
            //             if(value === null || value === ''){
            //                 throw new Error('Please Select Stream mode');
            //             }
            //         }
            //     })
            //     .label('Stream Mode *'),

            nga.field('stream_type', 'choice')
                .attributes({ placeholder: 'Select Stream Type from dropdown list' })
                .choices([
                    { value: 'vr', label: 'Virtual Reality (VR)' },
                    { value: '360', label: '360° Video' },
                    { value: 'regular', label: 'Regular' }
                ])
                .validation({validator: function(value) {
                        if(value === null || value === ''){
                            throw new Error('Please Select Stream type');
                        }
                    }
                })
                .label('Stream Type *'),
            nga.field('token', 'boolean')
                .attributes({ placeholder: 'Token' })
                .validation({ required: true })
                .label('Token'),
            nga.field('token_url', 'string')
                .defaultValue('Token Url')
                .attributes({ placeholder: 'Token Url' })
                .validation({ required: true })
                .label('Token Url'),
/*            nga.field('encryption', 'boolean')
                .validation({ required: true })
                .label('Encryption'),
            nga.field('encryption_url', 'string')
                .defaultValue('Encryption url')
                .validation({ required: true })
                .label('Encryption url'),*/
            nga.field('drm_platform', 'choice')
                .attributes({ placeholder: 'Select from dropdown list' })
                .defaultValue('none')
                .choices([
                    { value: 'none', label: 'None' },
                    { value: 'encryption', label: 'Internal AES Encryption'},
                    { value: 'pallycon', label: 'Pallycon' },
                    { value: 'verimatrix', label: 'Verimatrix' },
                    { value: 'widevine', label: 'Widevine' }
                ])
                .validation({validator: function(value) {
                        if(value === null || value === ''){
                            throw new Error('Please Select DRM Platform');
                        }
                    }
                })
                .label('DRM Platform *'),

            nga.field('encryption_url')
                .label('Key Delivery URL')
                .defaultValue('')
                .validation({ required: false })
                .template('<ma-field ng-if="entry.values.drm_platform === \'encryption\' " field="::field" value="entry.values[field.name()]" entry="entry" entity="::entity" form="formController.form" datastore="::formController.dataStore"></ma-field>', true),


            nga.field('encryption_url')
                .label('Key Delivery URL')
                .defaultValue('')
                .validation({ required: false })
                .template('<ma-field ng-if="entry.values.drm_platform === \'widevine\' " field="::field" value="entry.values[field.name()]" entry="entry" entity="::entity" form="formController.form" datastore="::formController.dataStore"></ma-field>', true),


            nga.field('encryption', 'boolean')
                .validation({ required: false })
                .cssClasses('hidden')
                .label('')
                .defaultValue(0)
                .map(function (value, entry) {
                    if (!entry['encryption_url']) {
                        return false;

                    }
                    else return true;
                }),



            nga.field('thumbnail_url', 'string')
                .defaultValue('')
                .attributes({ placeholder: 'Thumbnail URL' })
                .validation({ required: false })
                .label('Thumbnail URL'),
            nga.field('template')
                .label('')
                .template(edit_button),
        ]);


    vodstream.editionView()
    	.title('<h4>Vod Streams <i class="fa fa-angle-right" aria-hidden="true"></i> Edit: {{ entry.values.vod_id }}</h4>')
    	.actions(['delete'])
        .fields([
            vodstream.creationView().fields(),
        ]);


	return vodstream;

}
