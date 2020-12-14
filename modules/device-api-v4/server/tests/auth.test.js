const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');


describe('Device API: Authentication', () => {

  it('should get personal settings', (done) => {
    api.get(`/apiv4/auth/personal-settings`)
      .set('x-access-token', config.token)
      .expect(404)
      .end((err, res) => {
        expect(res.body.error).to.be.an('object').to.haveOwnProperty('code').to.be.equal('USER_NOT_FOUND');
        done();
      });
  });

  it('should logout', (done) => {
    api.get(`/apiv4/auth/logout`)
      .set('x-access-token', config.token)
      .expect(200)
      .end((err, res) => {
        expect(res.body.data).to.be.a('number');
        done();
      });
  });
});