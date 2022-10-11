require('dotenv').config();
const { ApolloServer } = require('apollo-server-express');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const http = require('http');


const jwt = require('jsonwebtoken');
// ! UPPERCASE BECAUSE UPPERCASE IN FSO.
const JWT_SECRET = process.env.SECRET;

const mongoose = require('mongoose');

const User = require('./models/user');

const typeDefs = require('./schema');
const resolvers = require('./resolver');

const { v1: uuid } = require('uuid');
const url = process.env.MONGODB_URI;
console.log(url);

mongoose.connect(url)
  .then(result => {
    console.log('Connected TO MONGODB');
  })
  .catch((error) => {
    console.log('ERROR CONNECTING TO MONGODB', error.message)
  });

// !  REPLACING WITH APOLLO SERVER EXPRESS. 
// * THIS server is now within Start function.
// ? Not Removing this to compare for future USES.
// const server = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: async ({ req }) => {
//     const auth = req? req.headers.authorization : null ;
//     if (auth && auth.toLowerCase().startsWith('bearer')){
//       const decodedToken = jwt.verify(
//         auth.substring(7), JWT_SECRET
//       )
//       const currentUser = await User.findById(decodedToken.id).populate('friends');
//       return { currentUser }; 
//     }
//   }
// })



// server.listen().then(({ url }) => {
//   console.log(`Server ready at ${url}`)
// })


// * START is now within a function

const start = async() => {
  const app = express();
  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({typeDefs, resolvers});

  const server = new ApolloServer({
    schema,
    context: async({ req }) => {
      const auth = req? req.headers.authorization : null;
      if ( auth && auth.toLowerCase().startsWith('bearer ')){
        const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
        const currentUser = await User.findById(decodedToken.findById).populate('friends');
        return { currentUser };
      }
    },
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  })

  await server.start();
  
  server.applyMiddleware({
    app,
    path: '/'
  })

  const PORT = 4000;

  httpServer.listen(PORT, () => 
    console.log(`SERVER IS NOW RUNNING AT 'http://localhost:${PORT}'`)
  )
}

// ? Calling the function that does the setup and starts the server
start();