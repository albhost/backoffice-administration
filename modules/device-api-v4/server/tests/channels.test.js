const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');


describe('Device API: Channels', () => {

  it('should get channels list', (done) => {
    api.get(`/apiv4/channels/list`)
      .set('x-access-token', config.token)
      .expect(200)
      .end((err, res) => {
        expect(res.body.data).to.be.an('array');
        const channels = res.body.data;
        channels.forEach(channel => {
          expect(channel.id).to.be.a('number');
          expect(channel.genre_id).to.be.a('number');
          expect(channel.channel_number).to.be.a('number');
          expect(channel.title).to.be.a('string');
          expect(channel.icon_url).to.be.a('string');
          expect(channel.pin_protected).to.be.a('boolean');
          expect(channel.catchup_mode).to.be.a('number');
          expect(channel.stream_source_id).to.be.a('number');
          expect(channel.stream_url).to.be.a('string');
          expect(channel.channel_mode).to.be.a('string');
          expect(channel.stream_format).to.be.a('string');
          expect(channel.token).to.be.a('number');
          expect(channel.token_url);
          expect(channel.encryption).to.be.a('number');
          expect(channel.encryption_url);
          expect(channel.drm_platform).to.be.a('string');
          expect(channel.is_octoshape).to.be.a('number');
          expect(channel.favorite_channel).to.be.a('boolean');
        });
        done();
      });
  });

  it.skip('should get channels list - not found', (done) => {
    api.get(`/apiv4/channels/list`)
      .set('x-access-token', config.token)
      .expect(204)
      .end((err, res) => {
        done();
      });
  });
});