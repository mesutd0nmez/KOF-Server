import mongoose from 'mongoose'

const productSchema = mongoose.Schema(
  {
    name: { type: String },
    price: { type: String },
    description: { type: String },
    status: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    attributes: [String],
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Product = mongoose.model('Product', productSchema)

export default Product
