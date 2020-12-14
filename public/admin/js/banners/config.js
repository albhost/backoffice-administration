import edit_button from '../edit_button.html';
import filter_genre_btn from '../filter_genre_btn.html';
import modalImageUpload from "../../templates/modalImageUpload.html";

export default function (nga, admin) {
    let banners = admin.getEntity('banners');
    banners.listView()
        .title('<h4>Banners <i class="fa fa-angle-right" aria-hidden="true"></i> List</h4>')
        .fields([
            nga.field('name')
                .label('Banner Name'),
            nga.field('size')
                .label('Size'),
            nga.field('img_url')
                .template('<img src="{{ entry.values.img_url }}" height="45" width="45" />')
                .label('Image'),
            nga.field('link')
                .label('Link')
        ])
        .listActions([]);

    banners.creationView()
        .title('<h4>Ads <i class="fa fa-angle-right" aria-hidden="true"></i> Send: ad</h4>')
        .onSubmitSuccess(['progression', 'notification', '$state', 'entry', 'entity', function (progression, notification, $state, entry, entity) {
            notification.log(`Ads send successfully`, {addnCls: 'humane-flatty-success'});
            // redirect to the list view
            $state.go($state.current, {}, {reload: true})
                .then($state.go($state.get('list'), {entity: entity.name()})); // cancel the default action (redirect to the edition view)
            return false;
        }])
        .fields([
            nga.field('name', 'string')
                .validation({required: true})
                .attributes({placeholder: 'Banners name'})
                .label('Banner Name'),
            nga.field('size', 'choice')
                .choices([
                    {value: 'small', label: 'small'},
                    {value: 'large', label: 'large'}
                ])
                .validation({required: true})
                .attributes({placeholder: 'Select from dropdown list filter values'})
                .label('Size'),
            nga.field('img_url','file')
                .uploadInformation({ 'url': '/file-upload/single-file/banners/img_url','apifilename': 'result'})
                .template('<div class="row">'+
                    '<div class="col-xs-12 col-sm-1"><img src="{{ entry.values.img_url }}" height="40" width="40" /></div>'+
                    '<div class="col-xs-12 col-sm-8"><ma-file-field field="field" value="entry.values.img_url"></ma-file-field></div>'+
                    '</div>'+
                    '<div class="row"><small id="emailHelp" class="form-text text-muted">Not larger than 1 MB</small></div>')
                .validation({
                    validator: function(value) {
                        if (value == null) {
                            throw new Error('Please, choose image');
                        }else {
                            var image_url = document.getElementById('img_url');
                            if (image_url.value.length > 0) {
                                if(image_url.files[0].size > 614400 ){
                                    throw new Error('Your Image is too Big, not larger than 1 MB');
                                }
                            }
                        }
                    }
                })
                .label('Image *'),


            nga.field('link', 'string')
                .validation({required: true})
                .attributes({placeholder: 'Link'})
                .label('Link'),
            nga.field('template')
                .label('')
                .template(edit_button),
        ]);
    return banners;

}