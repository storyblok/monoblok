export default (key: string, field: any) => {
  switch (field.field_type) {
    case 'native-color-picker':
      return {
        [key]: {
          properties: {
            color: { type: 'string' },
          },
          required: ['color'],
          type: 'object',
        },
      };
    default:
      return {};
  }
};
