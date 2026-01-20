import React, { useLayoutEffect,useState} from 'react'
import { createPortal } from 'react-dom'


function createWrapperAndAppendToBody(wrapperId) {
    const wrapperElement = document.createElement('div');
    wrapperElement.setAttribute("id", wrapperId);
    document.body.appendChild(wrapperElement);
    return wrapperElement;
}

export default function ReactPortal({children,wrapperId='modal'}) {
    const [wrapperElement, setWrapperElement] = useState(null);

    useLayoutEffect(() => {
        let element = document.getElementById(wrapperId);
        let systemCreated = false;
        if(!element){
            systemCreated = true;
            element = createWrapperAndAppendToBody(wrapperId);
        }
        setWrapperElement(element);
        return () => {
            if(element && element.parentNode && systemCreated){
                element.parentNode.removeChild(element);
            }
        }
    },[wrapperId]);

    if(wrapperElement === null) return null;
    return createPortal(children, wrapperElement);
}
