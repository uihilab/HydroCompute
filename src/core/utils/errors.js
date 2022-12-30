/**
 * Error classes to divert issues throughout the code.
 */

export class ValueErr extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, ValueErr.prototype)
    }
}

export class NotImplemented extends Error {
    constructor(message){
        super(message)
        Object.setPrototypeOf(this, NotImplemented.prototype)
    }
}

