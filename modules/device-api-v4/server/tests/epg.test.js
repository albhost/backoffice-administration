const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');


describe('Device API: EPG data', () => {

  it('should get EPG data', (done) => {
    api.get(`/apiv4/epg/data`)
      .set('x-access-token', config.token)
      .expect(200)
      .end((err, res) => {
        expect(res.body.data).to.be.an('array');
        let epgData = res.body.data;
        epgData.forEach(epg => {
          expect(epg.id).to.be.a('number');
          expect(epg.channel_number).to.be.a('number');
          expect(epg.title).to.be.a('string');
          expect(epg.icon_url).to.be.a('string');
          expect(epg.epg_data).to.be.an('array')
        });
        done();
      });
  });

  it('should get EPG data with query params', (done) => {
    api.get(`/apiv4/epg/data`)
      .set('x-access-token', config.token)
      .query({ start: 100, end: 1000, channelnumbers: "1,2,3" })
      .expect(200)
      .end((err, res) => {
        expect(res.body.data).to.be.an('array').lengthOf(3);
        let epgData = res.body.data;
        epgData.forEach(epg => {
          expect(epg.id).to.be.a('number');
          expect(epg.channel_number).to.be.a('number');
          expect(epg.title).to.be.a('string');
          expect(epg.icon_url).to.be.a('string');
          expect(epg.epg_data).to.be.an('array')
        });
        done();
      });
  });

});