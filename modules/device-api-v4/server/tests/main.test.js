const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');
const { log } = require('winston');


describe('Device API: Main menu', () => {

  it('should get main meu list', (done) => {
    api.get(`/apiv4/main/device-menu`)
      .set('x-authorization', config.token)
      .expect(200)
      .end((err, res) => {
        expect(res.body.data).to.be.an('array');
        let deviceMenu = res.body.data;
        deviceMenu.forEach(menu => {
          expect(menu.id).to.be.a('number');
          expect(menu.title).to.be.a('string');
          expect(menu.url).to.be.a('string');
          expect(menu.icon_url).to.be.a('string');
          expect(menu.icon).to.be.a('string');
          expect(menu.menu_code).to.be.a('number');
          expect(menu.position).to.be.a('number');
          expect(menu.menucode).to.be.a('number');
        });
        done();
      });
  });

});