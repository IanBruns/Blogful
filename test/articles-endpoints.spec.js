const { expect } = require('chai');
const knex = require('knex');
const { compile } = require('morgan');
const supertest = require('supertest');
const app = require('../src/app');
const { makeArticlesArray, makeMaliciousArticle } = require('./articles.fixtures');

describe('Articles Endpoints', () => {
    let db;

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        });
        app.set('db', db);
    });

    after('disconnect from db', () => db.destroy());

    before('clean the table', () => db('blogful_articles').truncate());

    afterEach('cleanup', () => db('blogful_articles').truncate());

    describe('GET /api/articles', () => {
        context('Given no articles in the database', () => {
            it('GET /api/articles returns 200 with an empty list', () => {
                return supertest(app)
                    .get('/api/articles')
                    .expect(200, []);
            });
        });

        context('Given there are articles in the database', () => {
            const testArticles = makeArticlesArray();

            beforeEach('insert articles', () => {
                return db
                    .into('blogful_articles')
                    .insert(testArticles);
            });

            it(`Get /api/articles respons with a 200 and all of the articles`, () => {
                return supertest(app)
                    .get('/api/articles')
                    .expect(200, testArticles);
            });
        });

        context(`Given an XSS attack article`, () => {
            const { maliciousArticle, expectedArticle } = makeMaliciousArticle();

            beforeEach('insert malicious article', () => {
                return db
                    .into('blogful_articles')
                    .insert([maliciousArticle]);
            });

            it('Removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api/articles`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body[0].title).to.eql(expectedArticle.title);
                        expect(res.body[0].content).to.eql(expectedArticle.content);
                    });
            });
        });
    });

    describe('GET /api/articles/:article_id', () => {
        context('Given no articles in the Database', () => {
            it(`responds with a 404 and Doesn't exist object`, () => {
                const articleId = 123456;
                return supertest(app)
                    .get(`/api/articles/${articleId}`)
                    .expect(404, { error: { message: `Article doesn't exist` } });
            });
        });

        context('Given there are articles in the database', () => {
            const testArticles = makeArticlesArray();

            beforeEach('insert articles', () => {
                return db
                    .into('blogful_articles')
                    .insert(testArticles);
            });

            it(`GET /api/articles/:article_id responds with a 200 and the specified article`, () => {
                const articleId = 2;
                const expectedArticle = testArticles[articleId - 1];

                return supertest(app)
                    .get(`/api/articles/${articleId}`)
                    .expect(200, expectedArticle);
            });
        });

        context(`Given an XSS attack article`, () => {
            const { maliciousArticle, expectedArticle } = makeMaliciousArticle();

            beforeEach('insert malicious article', () => {
                return db
                    .into('blogful_articles')
                    .insert([maliciousArticle]);
            });

            it('Removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api/articles/${maliciousArticle.id}`)
                    .expect(200)
                    .expect(res => {
                        // eslint-disable-next-line no-useless-escape
                        expect(res.body.title).to.eql(expectedArticle.title);
                        expect(res.body.content).to.eql(expectedArticle.content);
                    });
            });
        });
    });

    describe('POST /api/articles', () => {
        it('creates an article responding with a 201 and the new article', function () {
            this.retries(3);

            const newArticle = {
                title: 'New title',
                style: 'Listicle',
                content: '1) Chris Hemsworth 2) Liam Hemsworth'
            };

            return supertest(app)
                .post('/api/articles')
                .send(newArticle)
                .expect(201)
                .expect(res => {
                    expect(res.body.title).to.eql(newArticle.title);
                    expect(res.body.style).to.eql(newArticle.style);
                    expect(res.body.content).to.eql(newArticle.content);
                    expect(res.body).to.have.property('id');
                    expect(res.headers.location).to.eql(`/api/articles/${res.body.id}`);

                    const expectedDate = new Date().toLocaleString();
                    const actualDate = new Date(res.body.date_published).toLocaleString();
                    expect(actualDate).to.eql(expectedDate);
                })
                .then(postRes => {
                    return supertest(app)
                        .get(`/api/articles/${postRes.body.id}`)
                        .expect(postRes.body);
                });
        });

        const requiredFields = ['title', 'style', 'content'];
        requiredFields.forEach(field => {
            const newArticle = {
                title: '400 Test Title',
                style: 'Listicle',
                content: '400 Test Content'
            };

            it(`responds with a 400 and an error message when the '${field}' is missing`, () => {
                delete newArticle[field];

                return supertest(app)
                    .post('/api/articles')
                    .send(newArticle)
                    .expect(400, {
                        error: { message: `Missing '${field}' in request body` }
                    });
            });
        });

        it('Removes XSS attack content from response', () => {
            const { maliciousArticle, expectedArticle } = makeMaliciousArticle();

            return supertest(app)
                .post('/api/articles')
                .send(maliciousArticle)
                .expect(201)
                .expect(res => {
                    expect(res.body.title).to.eql(expectedArticle.title);
                    expect(res.body.content).to.eql(expectedArticle.content);
                });
        });
    });

    describe('DELETE /api/articles/:article_id', () => {
        context('given there are not articles in the database', () => {
            it('responds with a 404', () => {
                const articleId = 12345;

                return supertest(app)
                    .delete(`/api/articles/${articleId}`)
                    .expect(404, { error: { message: `Article doesn't exist` } });
            });
        });

        context('given there are articles in the database', () => {
            const testArticles = makeArticlesArray();

            beforeEach('insert articles', () => {
                return db
                    .into('blogful_articles')
                    .insert(testArticles);
            });

            it('responds with a 204 and removes the article', () => {
                const idToRemove = 2;
                const expectedArticles = testArticles.filter(article => article.id !== idToRemove);

                return supertest(app)
                    .delete(`/api/articles/${idToRemove}`)
                    .expect(204)
                    .then(res =>
                        supertest(app)
                            .get('/api/articles')
                            .expect(expectedArticles)
                    );
            });
        });
    });

    describe.only(`PATCH /api/articles/:article_id`, () => {
        context(`given no articles`, () => {
            it(`respond with a 404`, () => {
                const articleId = 8675309;
                return supertest(app)
                    .patch(`/api/articles/${articleId}`)
                    .expect(404, { error: { message: `Article doesn't exist` } });
            });
        });

        context(`Given articles in the database`, () => {
            const testArticles = makeArticlesArray();

            beforeEach('insert articles into db', () => {
                return db
                    .into('blogful_articles')
                    .insert(testArticles);
            });

            it(`responds with a 204 and updates the article`, () => {
                const idToUpdate = 2;
                const updateArticle = {
                    title: 'updated article title',
                    style: 'Interview',
                    content: 'updated article content'
                };
                const expectedArticle = {
                    ...testArticles[idToUpdate - 1],
                    ...updateArticle
                }

                return supertest(app)
                    .patch(`/api/articles/${idToUpdate}`)
                    .send(updateArticle)
                    .expect(204)
                    .then(res =>
                        supertest(app)
                            .get(`/api/articles/${idToUpdate}`)
                            .expect(expectedArticle)
                    )
            });
        });
    });
});