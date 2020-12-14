import edit_button from '../edit_button.html'

export default function(nga, admin) {
    var VodMenuCarousel = admin.getEntity('vodMenuCarousel')

    VodMenuCarousel.listView()
        .title(
            '<h4>Vod Menu Carousel<i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>'
        )
        .batchActions([])
        .actions(['create'])
        .fields([
            nga.field('id').label('ID'),
            nga
                .field('vod_menu_id', 'reference')
                .targetEntity(admin.getEntity('vodMenu'))
                .targetField(nga.field('name'))
                .isDetailLink(false)
                .label('Vod Menu Name'),
            nga.field('name', 'string').label('Carousel Name'),
            nga.field('order', 'number').label('Order'),
            nga.field('url', 'string').label('Url'),
            nga.field('isavailable', 'boolean').label('Available')
        ])
        .listActions(['edit', 'delete'])

    VodMenuCarousel.creationView()
        .title(
            '<h4>Vod Menu Carousel<i class="fa fa-angle-right" aria-hidden="true"></i> Create: {{ entry.values.id }}</h4>'
        )
        .fields([
            nga
                .field('vod_menu_id', 'reference')
                .targetEntity(admin.getEntity('vodMenu'))
                .targetField(nga.field('name'))
                .remoteComplete(true, {
                    refreshDelay: 300,
                    searchQuery: function(search) {
                        return { q: search }
                    }
                })
                .attributes({
                    placeholder:
                        'Choose from dropdown list the vod menu that this carousel will belong to'
                })
                .validation({
                    validator: function(value) {
                        if (value === null || value === '') {
                            throw new Error('Please Select Vod Menu ID')
                        }
                    }
                })
                .label('Vod Menu ID *'),
            nga
                .field('name', 'string')
                .attributes({ placeholder: 'Name' })
                .validation({ required: true })
                .label('Carousel Name'),
            nga
                .field('description', 'text')
                .transform(function lineBreaks(value, entry) {
                    return value.split('\n').join('<br/>')
                })
                .attributes({ placeholder: 'Description' })
                .validation({ required: true, maxlength: 1000 })
                .label('Description'),
            nga
                .field('order', 'number')
                .attributes({ placeholder: 'Order' })
                .validation({ required: true })
                .label('Order'),

            nga.field('url', 'choice')
                .attributes({ placeholder: 'Choose from dropdown list the Carousel Category that this carousel will belong to' })
                .validation({
                    validator: function(value) {
                        if (value === null || value === '') {
                            throw new Error('Please Select Carousel Category')
                        }
                    },
                    required: true
                })
                .choices([
                    { value: '/apiv3/vod/vod_list', label: 'All Movies' },
                    { value: '/apiv3/vod/mostwatched', label: 'Most Watched' },
                    { value: '/apiv3/tv_show/tv_show_list', label: 'Tv Shows' },
                    { value: '/apiv3/vod/favorite_movies', label: 'Favorite Movies' },
                    { value: '/apiv3/tv_show/favorite_tv_shows', label: 'Favorite Tv Shows' },


                ])
                .validation({ required: true })
                .label('Carousel Category Menu'),


            nga.field('category_id', 'reference')
                .targetEntity(admin.getEntity('VodCategories'))
                .remoteComplete(true, {
                    refreshDelay: 300,
                    searchQuery: function(search) { return { q: search }; }
                })
                .targetField(nga.field('name'))
                .isDetailLink(false)
                .label('Carousel Category Name '),
            nga
                .field('isavailable', 'boolean')
                .attributes({ placeholder: 'Is Available' })
                .validation({ required: true })
                .label('Is Available'),

            nga
                .field('pin_protected','boolean')
                .attributes({ placeholder: 'Pin Protected' })
                .validation({ required: true })
                .label('Pin Protected Movie'),

            nga
                .field('adult_content', 'boolean')
                .attributes({ placeholder: 'Has adult content' })
                .validation({ required: true })
                .label('Has adult content '),


            /*        nga.field('adult_content', 'choice')
                        .defaultValue(false)
                        .validation({ required: true })
                        .choices([
                            { value: true, label: 'Yes' },
                            { value: false, label: 'No' }
                        ])
                        .attributes({ placeholder: 'Choose from dropdown list' })
                        .label('Has adult content'),*/


            nga.field('order_by', 'choice')
                .attributes({ placeholder: 'Choose from dropdown list a specified field to order by ' })
                .defaultValue('createdAt')
                .choices([
                    { value: 'clicks', label: 'clicks' },
                    { value: 'rate', label: 'rate' },
                    { value: 'expiration_time', label: 'expiration time' },
                    { value: 'release_date', label: 'release date' },
                    { value: 'price', label: 'price' },
                    { value: 'duration', label: 'duration' },
                    { value: 'createdAt', label: 'creation date' },
                ])
                .validation({ required: false })
                .label('Order Items '),


            nga.field('order_dir', 'choice')
                .attributes({ placeholder: 'Choose from dropdown list order direction field  ' })
                .defaultValue('desc')
                .choices([
                    { value: 'desc', label: 'descending' },
                    { value: 'asc', label: 'ascending' }
                ])
                .validation({ required: false })
                .label('Order Direction'),

            /*        nga
                        .field('url', 'string')
                        .defaultValue('')
                        .validation({ required: true })
                        .attributes({ placeholder: 'Url' })
                        .label('Url'),*/

            nga
                .field('template')
                .label('')
                .template(edit_button)
        ])

    VodMenuCarousel.editionView()
        .actions(['list'])
        .title(
            '<h4>Vod Menu Carousel<i class="fa fa-angle-right" aria-hidden="true"></i> Edit: {{ entry.values.id }}</h4>'
        )
        .fields([VodMenuCarousel.creationView().fields()])

    VodMenuCarousel.deletionView()
        .title(
            '<h4>Vod Menu Carousel<i class="fa fa-angle-right" aria-hidden="true"></i> Remove <span style ="color:red;"> {{ entry.values.id }}'
        )
        .actions([
            '<ma-back-button entry="entry" entity="entity"></ma-back-button>'
        ])

    return VodMenuCarousel
}
