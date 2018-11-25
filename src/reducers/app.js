import {
    UPDATE_LOCATION
} from '../actions/app.js';

const INIT_APP_STATE = {
    page: '/'
}

const app = (state = INIT_APP_STATE, action) => {
    switch (action.type) {
        case UPDATE_LOCATION:
            return {
                ...state,
                page: action.page
            };
        default:
            return state;
    }
}
  
export default app;