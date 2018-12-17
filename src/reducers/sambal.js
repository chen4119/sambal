import {
    UPDATE_LOCATION,
    UPDATE_SCREEN_SIZE
} from '../actions/sambal.js';

const INIT_SAMBAL_STATE = {
    path: '/',
    isSmallScreen: false
}

const sambal = (state = INIT_SAMBAL_STATE, action) => {
    switch (action.type) {
        case UPDATE_LOCATION:
            return {
                ...state,
                path: action.path
            };
            case UPDATE_SCREEN_SIZE:
            return {
                ...state,
                isSmallScreen: action.isSmallScreen
            };
        default:
            return state;
    }
}
  
export default sambal;