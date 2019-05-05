'use strict';

const graphql = require('graphql');

const User = require('../auth/User.model');

const UserRecord = new graphql.GraphQLObjectType({
  name: 'UserRecord',
  fields: () => ({
    ...User.collection.graphql.fields,
    role: { type: graphql.GraphQLString },
    email: { type: graphql.GraphQLString },
    email_verified: { type: graphql.GraphQLBoolean },
  }),
});

module.exports = () => ({
  queries: {
    self_profile: {
      description: 'fetch user profile',
      get type() {
        return UserRecord;
      },
      async resolve(parent, args, req) {
        return User.collection.toUserRecord(req.user);
      },
    },
  },
});