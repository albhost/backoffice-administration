const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');


describe('Device API: News', () => {
  it('should get news list', done => {
    api.get('/apiv3/news/list?page=1')
      .set('auth', config.newToken)
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(200);
        expect(res.body.response_object).to.be.an('array');
        let responseDate = res.body.response_object;
        responseDate.forEach(element => {
          expect(element.source).to.be.a('string').equal('TiBO IPTV');
          expect(element.title).to.be.a('string');
          expect(element.description).to.be.a('string');
          expect(element.timestamp).to.be.a('number').lessThan(Date.now());
        });
        done();
      });
  });
});