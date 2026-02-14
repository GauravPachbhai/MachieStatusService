import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    // Common fields
    imei: { type: String, required: true, trim: true, index: true },
    uid: { type: Number },
    dtm: { type: String },
    seq: { type: Number },
    sig: { type: Number },
    msg: { type: String },
    sid: { type: Number },
    stat: { type: Number },
    rcnt: { type: Number },

    // Format 1 fields
    model: { type: String },
    cid: { type: String },
    type: { type: String },
    hwver: { type: String },
    swver: { type: String },
    mdbver: { type: String },
    time: { type: String },
    nw: { type: String },

    // Format 2 fields
    alert: { type: String },
    info: { type: String },

    // Format 3: modbus array
    modbus: [
      {
        sid: { type: Number },
        stat: { type: Number },
        rcnt: { type: Number },
        reg1: { type: Number },
        reg2: { type: Number },
        reg3: { type: Number },
        reg4: { type: Number },
        reg5: { type: Number },
      },
    ],

    // Format 4: io and dev objects
    io: {
      di1: { type: Number },
      di2: { type: Number },
      di3: { type: Number },
      di4: { type: Number },
      op1: { type: Number },
      a1: { type: Number },
      a2: { type: Number },
      s1: { type: Number },
      p1: { type: Number },
    },
    dev: {
      sysv: { type: Number },
    },

    // Other possible fields
    T1: { type: Number },
    P1: { type: Number },
    T2: { type: Number },
    P2: { type: Number },
    T_run: { type: Number },
    M_down: { type: Number },
    shift: { type: Number },
    TBT: { type: Number },

    // New format fields
    CycleT: { type: Number },
    Prodcount: { type: Number },
    Trun: { type: Number },
    MdownT: { type: Number },
    Shift: { type: Number },
    TBD: { type: Number },
    MID: { type: String },
    CustomerID: { type: String },
    SubID: { type: String },
    DIN1: { type: Number },
    DIN2: { type: Number },
    DIN3: { type: Number },
    TrunS: { type: Number },
    MdownS: { type: Number },
    ShiftS: { type: Number },
    TBDS: { type: Number },
    reg8: { type: Number },

    // Processing fields
    processed: { type: Boolean, default: false },
    processed_at: { type: Date },
  },
  { timestamps: true, strict: false }
);

export default mongoose.model("MoulditDevice", DeviceSchema);
