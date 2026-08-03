import React from 'react';
import { ToastContext } from '../context/ToastContext';

export const useToast = () => React.useContext(ToastContext);
