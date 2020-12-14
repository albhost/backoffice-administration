const expect = require('chai').expect;
const supertest = require('supertest');
const api = supertest('http://localhost:8081');
const config = require('./config');


describe('Device API: Customers', () => {
  // update get messages
  it('should update the get messages to true - success', done => {
    api.post('/apiv3/customer_app/update_receive_message')
      .set('auth', config.newToken)
      .send({
        "get_messages": 1
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(200);
        expect(res.body.error_description).to.be.equal('OK');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });


  it('should update the get messages to false - success', done => {
    api.post('/apiv3/customer_app/update_receive_message')
      .set('auth', config.newToken)
      .send({
        "get_messages": 0
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(200);
        expect(res.body.error_description).to.be.equal('OK');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });


  it('should not update the get messages, get_messages different from 0 or 1 - failure', done => {
    api.post('/apiv3/customer_app/update_receive_message')
      .set('auth', config.newToken)
      .send({
        "get_messages": 2
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(400);
        expect(res.body.error_description).to.be.a('string').to.be.equal('E_BAD_REQUEST');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });

  it('should not update the get messages, get_messages is string - failure', done => {
    api.post('/apiv3/customer_app/update_receive_message')
      .set('auth', config.newToken)
      .send({
        "get_messages": 'yes'
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(400);
        expect(res.body.error_description).to.be.a('string').to.be.equal('E_BAD_REQUEST');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });

  // update show adult content
  it('should update to show adult content to true - success', done => {
    api.post('/apiv3/customer_app/update_show_adult')
      .set('auth', config.newToken)
      .send({
        "show_adult": 1
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(200);
        expect(res.body.error_description).to.be.equal('OK');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });


  it('should update to show adult content to false - success', done => {
    api.post('/apiv3/customer_app/update_show_adult')
      .set('auth', config.newToken)
      .send({
        "show_adult": 0
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(200);
        expect(res.body.error_description).to.be.equal('OK');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });


  it('should not update to show adult content, show_adult different from 0 or 1 - failure', done => {
    api.post('/apiv3/customer_app/update_show_adult')
      .set('auth', config.newToken)
      .send({
        "show_adult": 2
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(400);
        expect(res.body.error_description).to.be.a('string').to.be.equal('E_BAD_REQUEST');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });

  it('should not update the get messages, show_adult is boolean - failure', done => {
    api.post('/apiv3/customer_app/update_show_adult')
      .set('auth', config.newToken)
      .send({
        "show_adult": true
      })
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(400);
        expect(res.body.error_description).to.be.a('string').to.be.equal('E_BAD_REQUEST');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });

  it('should not update the get messages, no body - failure', done => {
    api.post('/apiv3/customer_app/update_show_adult')
      .set('auth', config.newToken)
      .send()
      .expect(200)
      .end((err, res) => {
        expect(res.body.status_code).to.be.equal(400);
        expect(res.body.error_description).to.be.a('string').to.be.equal('E_BAD_REQUEST');
        expect(res.body.response_object).to.be.an('array');
        done();
      });
  });
});