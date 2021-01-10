# Express Boilerplate!

This is a boilerplate project used for starting new projects!

## Scripts

Start the application `npm start`

Start nodemon for the application `npm run dev`

Run the tests `npm test`

## Deploying

When your new project is ready for deployment, add a new Heroku application with `heroku create`. This will make a new git remote called "heroku" and you can then `npm run deploy` which will push to this remote's main branch.

## Helpful Scripts

seeding: psql -U dunder_mifflin -d blogful -f ./seeds/seed.blogful_articles.sql