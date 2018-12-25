import {
    UPDATE_LOCATION,
    UPDATE_SCREEN_SIZE,
    RECEIVE_LAZY_RESOURCES
} from '../actions/sambal.js';

const INIT_SAMBAL_STATE = {
    path: '/',
    isSmallScreen: false,
    lazyResourcesLoaded: false
};

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
        case RECEIVE_LAZY_RESOURCES:
            return {
              ...state,
              lazyResourcesLoaded: true
            };
        default:
            return state;
    }
};
  
export default sambal;