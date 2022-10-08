require('dotenv').config();

const { ApolloServer, gql, UserInputError } = require('apollo-server');
const { v1: uuid } = require('uuid');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Person = require('./models/person');
const User = require('./models/user');
const person = require('./models/person');

const url = process.env.MONGODB_URI;
console.log(url);

// ! UPPERCASE BECAUSE UPPERCASE IN FSO.
const JWT_SECRET = process.env.SECRET;

mongoose.connect(url)
  .then(result => {
    console.log('Connected TO MONGODB');
  })
  .catch((error) => {
    console.log('ERROR CONNECTING TO MONGODB', error)
  });


// ? REMOVING TO IMPLEMENT MONGOOSE WITH GRAPHQL
// let persons = [
//   {
//     name: "Arto Hellas",
//     phone: "040-123543",
//     street: "Tapiolankatu 5 A",
//     city: "Espoo",
//     id: "3d594650-3436-11e9-bc57-8b80ba54c431"
//   },
//   {
//     name: "Matti Luukkainen",
//     phone: "040-432342",
//     street: "Malminkaari 10 A",
//     city: "Helsinki",
//     id: '3d599470-3436-11e9-bc57-8b80ba54c431'
//   },
//   {
//     name: "Venla Ruuska",
//     street: "Nallemäentie 22 C",
//     city: "Helsinki",
//     id: '3d599471-3436-11e9-bc57-8b80ba54c431'
//   },
// ]

const typeDefs = gql`
  type User {
    username: String!
    friends: [Person!]!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Address {
    street: String!
    city: String! 
  }

  type Person {
    name: String!
    phone: String
    address: Address!
    id: ID!
  }

  enum YesNo {
    YES
    NO
  }

  type Query {
    personCount: Int!
    allPersons(phone: YesNo): [Person!]!
    findPerson(name: String!): Person   
    me: User
  }

  type Mutation{
    addPerson(
      name: String!
      phone: String
      street: String!
      city: String!
    ): Person

    editNumber(
      name: String!
      phone: String!
    ): Person
  
    createUser(
      username: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token

    addAsFriend(
      name: String!
    ): User

  }


`

const resolvers = {
  Query: {
    personCount: async () => Person.collection.countDocuments(),

    allPersons: async (root ,args) => {
      if(!args.phone){
        return Person.find({})
      }
      return Person.find({phone: {$exists: args.phone === 'YES'}});
      
      // ? REMOVING FOR MONGOOSE IMPLEMENTATION
      // const byPhone = (person) => 
      //   args.phone === 'YES' ? person.phone : !person.phone
      // return persons.filter(byPhone)
    },

    findPerson: async (root, args) => Person.findOne({ name: args.name}),

    me : (root, args, context) => {
      return context.currentUser;
    },

  },
  
  Person: {
    address: (root) => {
      return { 
        street: root.street,
        city: root.city
      }
    }
  },
  Mutation:{
    addPerson: async (root, args, context) => {
      const person = new Person({ ...args });
      const currentUser = context.currentUser;
      
      if(!currentUser){
        throw new AuthenticationError('not authenticated');
      }

      try{
        await person.save();
        currentUser.friends = currentUser.friends.concat(person)
        await currentUser.save();
      } catch ( error ) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      }

      return person;
    },

    editNumber: async (root, args) => {
      const person = await Person.findOne({ name : args.name });
      person.phone = args.phone;

      try{
        await person.save();
      } catch (error) { 
        throw new UserInputError(error.message, { 
          invalidArgs: args,
        })
      }

      return person;
    },

    createUser: async (root, args) => {
      const user = new User ({username: args.username})

      return user.save()
        .catch(error => {
          throw new UserInputError(error.message,{
            invalidArgs: args,
          })
        })
    },

    login: async(root, args) => {
      const user = await User.findOne({ username: args.username});

      if(!user || args.password !== 'secret') { 
        throw new UserInputError("wrong Credentials");
      }

      const userForToken = { 
        username: user.username,
        id: user._id,
      }

      return {value: jwt.sign(userForToken, JWT_SECRET)}
    },

    addAsFriend: async (root, args, { currentUser }) => {
      const isFriend = (person) => 
        currentUser.friends.map( f => f._id.toString()).includes(person._id.toString());
      
      if(!currentUser) {
        throw new AuthenticationError("not authenticated")
      }
    
      const person = await Person.findOne({ name: args.name });
      if( !isFriend(person) ) {
        currentUser.friends = currentUser.friends.concat(person);
      }

      await currentUser.save();
      return currentUser;
    }
  }


}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req? req.headers.authorization : null ;
    if (auth && auth.toLowerCase().startsWith('bearer')){
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id).populate('friends');
      return { currentUser }; 
    }
  }
})



server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})