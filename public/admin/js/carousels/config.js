import edit_button from '../edit_button.html';

export default function (nga, admin){
    var carousels = admin.getEntity('carousels');
    carousels.listView()
        .title('<h4>Carousels <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
        .listActions(['edit','<edit-channels type="editChannels" post="entry"></edit-channels>'])
        .batchActions([])
        .fields([
            nga.field('type')
                .label('Carousel Type'),
            nga.field('order_number')
                .label('Order'),
            nga.field('title')
                .label('Title'),
            nga.field('is_available','boolean')
                .label('Is Available'),
        ])
        .exportFields([
            carousels.listView().fields(),
        ]);


    carousels.deletionView()
        .title('<h4>Carousels <i class="fa fa-angle-right" aria-hidden="true"></i> Remove <span style ="color:red;"> {{ entry.values.description }} </span></h4>')
        .actions(['<ma-back-button entry="entry" entity="entity"></ma-back-button>'])


    carousels.editionView()
        .title('<h4>Carousels: Edit  <i class="fa fa-angle-right" aria-hidden="true"></i></h4>')
        .actions(['list'])
        .fields([
            nga.field('type', 'string')
                .editable(false)
                .label('Type *'),
            nga.field('title', 'string')
                .validation({ required: true })
                .label('Title'),
            nga.field('order_number', 'number')
                .validation({ required: true })
                .label('Order'),
            nga.field('is_available', 'boolean')
                .validation({ required: true })
                .label('Available'),
            nga.field('template')
                .label('')
                .template(edit_button),
        ])

    return carousels;

}
