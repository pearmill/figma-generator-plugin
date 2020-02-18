import Papa from 'papaparse'

// This plugin will open a modal to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser enviroment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

const imageQueue = {}

const finishWithError = (errorStr) => {
  figma.notify(errorStr);

  return figma.closePlugin();
}

async function drawImage (id, parentId, data) {
  const node = figma.getNodeById(id) as GeometryMixin;
  const newFills = []

  for (const paint of node.fills) {
    if (paint.type === 'IMAGE') {
      const imagePaint = JSON.parse(JSON.stringify(paint));
      imagePaint.visible = true;
      imagePaint.imageHash = figma.createImage(data).hash;
      newFills.push(imagePaint)
    } else {
      newFills.push(JSON.parse(JSON.stringify(paint)))
    }
  }

  console.log(newFills)
  node.fills = newFills
  console.log('node.fills after setting', node.fills)
  delete imageQueue[id]
}

async function drawNode (id, frame, fields, values) {
  console.log('drawNode', id, fields, values)
  const newFrame = frame.clone();

  await Promise.all(fields.map(async (field) => {
    var [fieldType, fieldFilter] = field.split('_');

    switch (fieldType) {
      case 'TEXT':
        const [text] = newFrame.children.filter((childNode : SceneNode) => {
          return childNode.type === 'TEXT' && (childNode.characters.match(fieldFilter) !== null)
        })

        if (!text) { break }

        let len = text.characters.length
        for (let i = 0; i < len; i++) {
          await figma.loadFontAsync(text.getRangeFontName(i, i + 1))
        }

        text.characters = values[field]
        break;

      case 'RECTANGLE':
        const [rectImage] = newFrame.children.filter((childNode : SceneNode) => {
          if (childNode.type !== 'RECTANGLE') return false;
          let hasFillColor = false

          for (const paint of childNode.fills) {
            if (paint.type === 'SOLID' && paint.color) {
              const colorStr = `${(255 * paint.color.r).toFixed(0)}${(255 * paint.color.g).toFixed(0)}${(255*paint.color.b).toFixed(0)}`

              if (colorStr.match(fieldFilter) !== null) {
                hasFillColor = true;
              }
            }
          }

          return hasFillColor
        });

        break;
      
      case 'ELLIPSE': 
        const [circleImage] = newFrame.children.filter((childNode : SceneNode) => {
          if (childNode.type !== 'ELLIPSE') return false;
          let hasFillColor = false

          for (const paint of childNode.fills) {
            if (paint.type === 'SOLID' && paint.color) {
              const colorStr = `${(255 * paint.color.r).toFixed(0)}${(255 * paint.color.g).toFixed(0)}${(255*paint.color.b).toFixed(0)}`

              if (colorStr.match(fieldFilter) !== null) {
                hasFillColor = true;
              }
            }
          }

          return hasFillColor
        })

        console.log('circleImage', circleImage)

        imageQueue[circleImage.id] = true

        figma.ui.postMessage({
          id: circleImage.id,
          parent_id: newFrame.id,
          filter: fieldFilter,
          src: values[field]
        })

        break;
    }
  }))

  console.log('newFrame', newFrame);
  newFrame.x = frame.x + ((frame.width + 150) * (id + 1));

  figma.currentPage.appendChild(newFrame);

  return newFrame;
}

async function drawEverything (fields, data) {
  const [frame] = figma.currentPage.selection

  if (frame.type !== 'FRAME') {
    return finishWithError('Template has to be a frame.');
  }    
  
  const nodes: SceneNode[] = [];

  for (let i = 0; i < data.length; i++) {
    console.log(i, data[i])
    nodes.push(await drawNode(i, frame, fields, data[i]));
  }
  
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
}

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

figma.ui.onmessage = async msg => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  console.log('msg', msg)

  if (msg.type === 'cancel') {
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    return figma.closePlugin();
  }

  if (msg.type === 'error') {
    return finishWithError(msg.message);
  }

  if (!figma.currentPage.selection.length) {
    return finishWithError('No template is selected.');
  }

  if (msg.type === 'image-data') {
    try {
      await drawImage(msg.id, msg.parent_id, msg.data);
    } catch (e) {
      console.error(e);
      figma.notify(`Something went wrong: ${e.message}`)
      delete imageQueue[msg.id]
    }

    if (Object.keys(imageQueue).length === 0) {
      return figma.closePlugin();
    }
  }

  if (msg.type === 'process-csv') {
    const csv = Papa.parse(msg.data.trim(), { header: true, delimiter: ',' });

    if (csv.errors && csv.errors.length) {
      csv.errors.forEach(err => figma.notify(err.message));
    }

    if (csv.data && csv.data.length) {
      try {
        await drawEverything(csv.meta.fields, csv.data)

        if (Object.keys(imageQueue).length === 0) {
          return figma.closePlugin();
        }
      } catch (e) {
        console.error(e);
        figma.notify('Something went wrong: ' + e.message);
      }
    }
  }
};
