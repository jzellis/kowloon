import React, { useEffect, useState } from "react";
import { FaCaretRight, FaCaretDown } from "react-icons/fa";
import { useSelector } from "react-redux";
const PageTree = ({ items, level=0 }) => {
  return (
    <ul className="h-auto mb-0">
      {items.map(page => (
        <PageNode key={page.id} page={page} level={level} />
      ))}
    </ul>
  );
};

const menuTextSize = ["text-base", "text-sm", "text-xs"];

const PageNode = ({ page, level }) => {
    const currentPage = useSelector((state) => state.ui.currentPage);
  const [isOpen, setIsOpen] = useState(false);
    const hasItems = page.items && page.items.length > 0;
    
    useEffect(() => {
        if (page.items.map(p => `/pages/${p.slug}`).includes(currentPage)) setIsOpen(true);

    }, page.items);
  return (
      <li className={`${!page.parentFolder ? "mb-0" : "ml-8"} `}>
          
          {/* {page.image && (
              <span class={`w-[${2 - level}em] h-[${2 - level}em] overflow-hidden relative inline-block align-middle rounded bg-gray-400`}>
              <img
                src={page.image}
                      alt={page.title}
                class="absolute top-1/2 left-1/2 w-auto h-full -translate-x-1/2 -translate-y-1/2 object-cover"
              />
            </span>
          )} */}
          {hasItems ? <span
              onClick={() => hasItems && setIsOpen(!isOpen)}
              className="cursor-pointer select-none mr-2"
          >
              {isOpen ? <FaCaretDown className="inline" /> : <FaCaretRight className="inline text-gray-400" />}
          </span> : <span className="mr-6"></span>}

          <a href={`/pages/${page.slug}`} className={`${level <= menuTextSize.length ? menuTextSize[level] : menuTextSize[menuTextSize.length - 1]} hover:font-bold ${currentPage === `/pages/${page.slug}` && "font-bold"}`}>
              {page.title}</a>

          {hasItems && isOpen && (
        <PageTree items={page.items} level={level + 1} />
      )}
    </li>
  );
};

export default PageTree;


// import { useState } from "react";
// import { NavLink } from "react-router-dom";
// import { FaCaretRight, FaCaretDown } from "react-icons/fa";
// import "./index.css";

// const PageTree = ({ items }) => {
//     return (<ul className={`page-tree leading-5`}>
//         {items.map((item, i) => {
//             (<>{item.id}</>)
//         })}
//     </ul>);
// }

// const PageNode = ({ page }) => {
//     console.log("Page: ", page)
//     const [showSubmenu, setShowSubmenu] = useState(false);

//     return (<li key={i} className={!page.parentFolder ? "mb-4" : "mb-0 list-['-_']"}>
//         {page.items.length > 0 && (<span onClick={() => setShowSubmenu(!showSubmenu)}>{showSubmenu ? <FaCaretDown className="inline" /> : <FaCaretRight className="inline" />}</span>)}
//         <a href={`/pages/${page.slug}`} title={page.title}><img src={page.image} className="avatar rounded-sm h-[1em] w-auto max-w-[2em] mr-2" /><span className={`${!page.parentFolder ? "font-bold" : "font-light"}`}>{page.title}</span></a>
//         {page.items && showSubmenu && <PageTree items={page.items} /> }
//     </li>)
// }

// export default PageTree