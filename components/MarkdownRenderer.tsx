
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderLine = (line: string, index: number) => {
    // Bold text: **text**
    const boldedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Headings
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-xl font-bold mt-4 mb-2 text-green-700" dangerouslySetInnerHTML={{ __html: boldedLine.substring(4) }} />;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-2xl font-bold mt-6 mb-3 text-green-800" dangerouslySetInnerHTML={{ __html: boldedLine.substring(3) }} />;
    }
    if (line.startsWith('# ')) {
        return <h1 key={index} className="text-3xl font-bold mt-8 mb-4 text-green-900" dangerouslySetInnerHTML={{ __html: boldedLine.substring(2) }} />;
    }

    // List items
    if (line.startsWith('* ')) {
      return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: boldedLine.substring(2) }} />;
    }
    
    // Paragraphs
    if (line.trim() === '') {
      return null; // Don't render empty lines as paragraphs
    }
    
    return <p key={index} className="my-2" dangerouslySetInnerHTML={{ __html: boldedLine }} />;
  };

  const lines = content.split('\n');
  const elements = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = line.startsWith('* ');

    if (isListItem && !inList) {
      // Start of a new list
      inList = true;
      elements.push(<ul key={`ul-start-${i}`} className="my-2">{renderLine(line, i)}</ul>);
    } else if (isListItem && inList) {
      // Continue list - find the last ul and append to it
      const lastElement = elements[elements.length - 1];
      if (lastElement && lastElement.type === 'ul') {
        const newChildren = React.Children.toArray(lastElement.props.children);
        newChildren.push(renderLine(line, i));
        elements[elements.length - 1] = React.cloneElement(lastElement, { key: lastElement.key }, newChildren);
      }
    } else {
      // Not a list item, or end of list
      inList = false;
      elements.push(renderLine(line, i));
    }
  }

  return <>{elements}</>;
};

export default MarkdownRenderer;
