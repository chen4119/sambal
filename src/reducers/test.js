import {
    OPEN_SNACKBAR,
    CLOSE_SNACKBAR
} from '../actions/test.js';
  
const INITIAL_STATE = {
    snackbarOpened: false
};

const test = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case OPEN_SNACKBAR:
            return {
                ...state,
                snackbarOpened: true
            };
        case CLOSE_SNACKBAR:
            return {
                ...state,
                snackbarOpened: false
            };
        default:
            return state;
    }
};

export default test;
  