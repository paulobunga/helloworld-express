'use strict';

/** @module common/data/graphql */

const Logger = require('@/common/logger').createLogger($filepath(__filename));

const path = require('path');

const graphql = require('graphql');

const DataWaterline = require('./waterline');

const APP_CONFIG = require('../../../app-config');

const GraphQLTypes = require('./graphql.types');

const DEFAULTS = {
  graphql_settings: {
    exclude: false,
    reference: true,
    count: true,
    index: true,
    item: true,
    custom_types: null,
  },
};

class DataGraphql {
  constructor() {
    // GraphQL schema
    this.schema = null;
  }

  /**
   * GraphQL types
   */

  getGraphqlFieldFromWaterlineAttribute(collectionName, attributeName, attributeConfig) {
    const result = {};

    if (attributeConfig.type === 'string') {
      result.type = graphql.GraphQLString;
    } else if (attributeConfig.type === 'number') {
      result.type = graphql.GraphQLFloat;
    } else if (attributeConfig.type === 'boolean') {
      result.type = graphql.GraphQLBoolean;
    } else if (attributeConfig.type === 'json') {
      result.type = GraphQLTypes.JSON;
    } else if (attributeConfig.type === 'ref') {
      result.type = GraphQLTypes.Raw;
    } else {
      return;
    }

    // if (attributeConfig.validations && attributeConfig.validations.isIn) {
    //   result.type = new graphql.GraphQLEnumType({
    //     name: attributeName,
    //     values: attributeConfig.validations.isIn.reduce((acc, item) => ({ ...acc, [item]: { value: item } }), {}),
    //   });
    // }

    return result;
  }

  generateGraphQLFromWaterline() {
    const { ontology } = DataWaterline;

    const queries = {
      hello: {
        args: {
          name: {
            type: graphql.GraphQLString,
          },
        },
        type: graphql.GraphQLString,
        resolve(parent, args) {
          return `Hello ${args.name || 'World'}!`;
        },
      },
    };

    const mutations = {
      sayHello: {
        args: {
          name: {
            type: graphql.GraphQLString,
          },
        },
        type: graphql.GraphQLString,
        resolve(parent, args) {
          return `Hello ${args.name}!`;
        },
      },
    };

    Object.values(ontology.collections).forEach((collection) => {
      if (collection.junctionTable || collection.identity === 'archive') {
        collection.graphql_settings = {
          exclude: true,
        };
        return;
      }

      collection.graphql_settings = {
        ...DEFAULTS.graphql_settings,
        ...(collection.graphql_settings || {}),
      };
    });

    Object.values(ontology.collections).forEach((collection) => {
      if (collection.graphql_settings.exclude) {
        return;
      }

      const collectionName = collection.tableName;

      const collectionFields = Object.entries(collection.attributes).reduce((acc, [attributeName, attributeConfig]) => {
        if (collection.attributes_to_strip_in_graphql.includes(attributeName)) {
          return acc;
        }

        if (collection.attributes_to_strip_in_json.includes(attributeName)) {
          return acc;
        }

        let field;

        if (attributeName === collection.primaryKey) {
          field = {
            type: graphql.GraphQLID,
          };
        } else if (attributeConfig.model && ontology.collections[attributeConfig.model].graphql_settings.reference) {
          field = {
            get type() {
              return ontology.collections[attributeConfig.model].graphql.type;
            },
            async resolve(parent) {
              return await ontology.collections[attributeConfig.model].findOne(parent[attributeName]);
            },
          };
        } else if (
          attributeConfig.collection
          && ontology.collections[attributeConfig.collection].graphql_settings.reference
        ) {
          field = {
            get type() {
              return new graphql.GraphQLList(ontology.collections[attributeConfig.collection].graphql.type);
            },
            async resolve(parent, args) {
              const [targetCollection, throughCollection, attributes] = collection.association(attributeName);

              let ids = null;

              if (throughCollection) {
                const data = await throughCollection.find().where({
                  [attributes.self]: parent.id,
                });
                ids = data.map((item) => item[attributes.target]);
              }

              let data = [];

              if (ids) {
                data = await targetCollection.find(ids);
              } else {
                data = await targetCollection.find().where({
                  [attributes.self]: parent.id,
                });
              }

              return data;
            },
          };
        } else {
          field = this.getGraphqlFieldFromWaterlineAttribute(collectionName, attributeName, attributeConfig);
        }

        if (!field) {
          return acc;
        }

        return {
          ...acc,
          [attributeName]: field,
        };
      }, {});

      const CollectionType = new graphql.GraphQLObjectType({
        name: collectionName,
        fields: collectionFields,
      });

      const collectionArgs = Object.entries(collectionFields).reduce((acc, [key, value]) => {
        if (collection.attributes[key].collection) {
          return acc;
        }
        return {
          ...acc,
          [key]: value.resolve
            ? {
              type: graphql.GraphQLID,
            }
            : value,
        };
      }, {});

      collection.graphql = {
        name: collectionName,
        args: collectionArgs,
        fields: collectionFields,
        type: CollectionType,
      };

      const FilterType = new graphql.GraphQLInputObjectType({
        name: `${collectionName}Filter`,
        fields: {
          ...collectionArgs,
        },
      });

      if (collection.graphql_settings.count) {
        const query = collection.graphql_settings.count === 'simple'
          ? {
            name: `${collectionName}Count`,
            description: `fetch ${collectionName} count`,
            type: graphql.GraphQLInt,
            async resolve(parent, args) {
              return await collection.count();
            },
          }
          : {
            name: `${collectionName}Count`,
            description: `fetch ${collectionName} count`,
            args: {
              filter: {
                type: FilterType,
              },
            },
            type: graphql.GraphQLInt,
            async resolve(parent, args) {
              return await collection.count().where(args.filter);
            },
          };

        queries[query.name] = query;
      }

      if (collection.graphql_settings.index) {
        const query = collection.graphql_settings.index === 'simple'
          ? {
            name: `${collectionName}Index`,
            description: `fetch ${collectionName} index`,
            type: new graphql.GraphQLList(CollectionType),
            async resolve(parent, args) {
              return await collection.find();
            },
          }
          : {
            name: `${collectionName}Index`,
            description: `fetch ${collectionName} index`,
            args: {
              filter: {
                type: FilterType,
              },
              offset: {
                type: graphql.GraphQLInt,
              },
              limit: {
                type: graphql.GraphQLInt,
              },
              sort: {
                type: graphql.GraphQLString,
              },
            },
            type: new graphql.GraphQLList(CollectionType),
            async resolve(parent, args) {
              return await collection
                .find()
                .where(args.filter)
                .skip(args.offset)
                .limit(args.limit)
                .sort(args.sort);
            },
          };

        queries[query.name] = query;
      }

      if (collection.graphql_settings.item) {
        const query = {
          name: collectionName,
          description: `fetch ${collectionName} item`,
          args: {
            [collection.primaryKey]: { type: graphql.GraphQLID },
          },
          type: CollectionType,
          async resolve(parent, args) {
            return await collection.findOne(args);
          },
        };

        queries[query.name] = query;
      }

      if (collection.graphql_settings.custom_types) {
        collection.graphql.custom_types = collection.graphql_settings.custom_types(collection);
      }
    });

    APP_CONFIG.GRAPHQL_FILES.forEach((filename) => {
      Logger.info('loading', filename);
      const graphqlDefinition = require(path.resolve(filename))();
      Object.assign(queries, graphqlDefinition.queries || {});
      Object.assign(mutations, graphqlDefinition.mutations || {});
    });

    const query = new graphql.GraphQLObjectType({
      name: 'Query',
      description: 'Query',
      fields: () => queries,
    });

    const mutation = new graphql.GraphQLObjectType({
      name: 'Mutation',
      description: 'Mutation',
      fields: () => mutations,
    });

    const schema = new graphql.GraphQLSchema({
      query,
      mutation,
    });

    return schema;
  }

  /**
   * setup
   *
   * @returns {Promise}
   */
  async setup() {
    Logger.info('setup ...');

    this.schema = this.generateGraphQLFromWaterline();

    Logger.info('setup done');

    return this.schema;
  }

  /**
   * teardown
   *
   * @returns {Promise}
   */
  async teardown() {
    Logger.info('teardown ...');

    this.schema = null;

    Logger.info('teardown done');
  }

  /**
   * clear
   *
   * @returns {Promise}
   */
  async clear() {}
}

module.exports = new DataGraphql();

// @TODO allow filtering by many-to-many association in index queries
