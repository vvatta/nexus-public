/*
 * Sonatype Nexus (TM) Open Source Version
 * Copyright (c) 2008-present Sonatype, Inc.
 * All rights reserved. Includes the third-party code listed at http://links.sonatype.com/products/nexus/oss/attributions.
 *
 * This program and the accompanying materials are made available under the terms of the Eclipse Public License Version 1.0,
 * which accompanies this distribution and is available at http://www.eclipse.org/legal/epl-v10.html.
 *
 * Sonatype Nexus (TM) Professional Version is available from Sonatype, Inc. "Sonatype" and "Sonatype Nexus" are trademarks
 * of Sonatype, Inc. Apache Maven is a trademark of the Apache Software Foundation. M2eclipse is a trademark of the
 * Eclipse Foundation. All other trademarks are the property of their respective owners.
 */
import React from 'react';
import {waitFor, waitForElementToBeRemoved} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {when} from 'jest-when';
import {act} from 'react-dom/test-utils';
import axios from 'axios';
import {ExtJS, TestUtils} from '@sonatype/nexus-ui-plugin';

import ContentSelectorsForm from './ContentSelectorsForm';

import UIStrings from '../../../../constants/UIStrings';

jest.mock('axios', () => ({
  ...jest.requireActual('axios'), // Use most functions from actual axios
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));

jest.mock('@sonatype/nexus-ui-plugin', () => ({
  ...jest.requireActual('@sonatype/nexus-ui-plugin'),
  ExtJS: {
    requestConfirmation: jest.fn(),
    showErrorMessage: jest.fn()
  },
  Utils: {
    buildFormMachine: function(args) {
      const machine = jest.requireActual('@sonatype/nexus-ui-plugin').Utils.buildFormMachine(args);
      return machine.withConfig({
        actions: {
          logSaveSuccess: jest.fn(),
          logSaveError: jest.fn(),
          logLoadError: jest.fn()
        }
      })
    },
    isInvalid: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.isInvalid,
    isBlank: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.isBlank,
    isName: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.isName,
    notBlank: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.notBlank,
    fieldProps: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.fieldProps,
    saveTooltip: jest.requireActual('@sonatype/nexus-ui-plugin').Utils.saveTooltip
  }
}));

describe('ContentSelectorsForm', function() {
  const CONFIRM = Promise.resolve();
  const onDone = jest.fn();

  function renderEditView(itemId) {
    return renderView(<ContentSelectorsForm itemId={itemId} onDone={onDone}/>);
  }

  function renderCreateView() {
    return renderView(<ContentSelectorsForm onDone={onDone}/>);
  }

  function renderView(view) {
    return TestUtils.render(view, ({queryByLabelText, queryByText}) => ({
      name: () => queryByLabelText(UIStrings.CONTENT_SELECTORS.NAME_LABEL),
      type: () => queryByLabelText(UIStrings.CONTENT_SELECTORS.TYPE_LABEL),
      description: () => queryByLabelText(UIStrings.CONTENT_SELECTORS.DESCRIPTION_LABEL),
      expression: () => queryByLabelText(UIStrings.CONTENT_SELECTORS.EXPRESSION_LABEL),
      saveButton: () => queryByText(UIStrings.SETTINGS.SAVE_BUTTON_LABEL),
      cancelButton: () => queryByText(UIStrings.SETTINGS.CANCEL_BUTTON_LABEL),
      deleteButton: () => queryByText(UIStrings.SETTINGS.DELETE_BUTTON_LABEL),
      previewButton: () => queryByText(UIStrings.CONTENT_SELECTORS.PREVIEW.BUTTON)
    }));
  }

  it('renders the resolved data', async function() {
    const itemId = 'test';

    axios.get.mockImplementation((url) => {
      if (url === `/service/rest/v1/security/content-selectors/${itemId}`) {
        return Promise.resolve({
          data: {
            'name' : 'xss<img src="/static/rapture/resources/icons/x16/user.png" onload="alert(0)">',
            'type' : 'csel',
            'description' : 'description',
            'expression' : 'format == "raw"'
          }
        });
      }
      else if (url === '/service/rest/internal/ui/repositories?withAll=true&withFormats=true') {
        return Promise.resolve({data: []});
      }
    });

    const {loadingMask, name, type, description, expression, saveButton} = renderEditView(itemId);

    await waitForElementToBeRemoved(loadingMask);

    expect(name()).toHaveValue('xss<img src="/static/rapture/resources/icons/x16/user.png" onload="alert(0)">');
    expect(type()).toHaveTextContent('CSEL');
    expect(description()).toHaveValue('description');
    expect(expression()).toHaveValue('format == "raw"');
    expect(saveButton()).toHaveClass('disabled');
  });

  it('renders an error message', async function() {
    axios.get.mockReturnValue(Promise.reject({message: 'Error'}));

    const {container, loadingMask} = renderEditView('itemId');

    await waitForElementToBeRemoved(loadingMask);

    expect(container.querySelector('.nx-alert--error')).toHaveTextContent('Error');
  });

  it('requires the name and expression fields when creating a new content selector', async function() {
    axios.get.mockReturnValue(Promise.resolve({data: []}));

    const {loadingMask, name, expression, saveButton} = renderCreateView();

    await waitForElementToBeRemoved(loadingMask);

    await TestUtils.changeField(name, '');
    await TestUtils.changeField(expression, 'format == "raw"');
    expect(saveButton()).toHaveClass('disabled');

    await TestUtils.changeField(name, 'name');
    await TestUtils.changeField(expression, '');
    expect(saveButton()).toHaveClass('disabled');

    await TestUtils.changeField(name, 'name');
    await TestUtils.changeField(expression, 'format == "raw"');
    expect(saveButton()).not.toHaveClass('disabled');
  });

  it('fires onDone when cancelled', async function() {
    const {loadingMask, cancelButton} = renderCreateView();

    await waitForElementToBeRemoved(loadingMask);

    userEvent.click(cancelButton());

    await waitFor(() => expect(onDone).toBeCalled());
  });

  it('shows errors from the backend on the correct field', async function() {
    when(axios.post).calledWith('/service/rest/v1/security/content-selectors', expect.anything()).mockRejectedValue({
      response: {
        data: [
          {
            "id": "PARAMETER name",
            "message": "An error occurred with the name field"
          },
          {
            "id": "HelperBean.expression",
            "message": "Invalid CSEL: tokenization error in '\"maven2' at line 1 column 18"
          }
        ]
      }
    });

    const {expression, getByText, loadingMask, name, saveButton, savingMask} = renderCreateView();

    await waitForElementToBeRemoved(loadingMask);

    await TestUtils.changeField(name, 'test');
    await TestUtils.changeField(expression, 'format == "maven2');

    userEvent.click(saveButton());

    await waitForElementToBeRemoved(savingMask);

    expect(getByText('An error occurred with the name field')).toBeInTheDocument();
    expect(getByText('Invalid CSEL: tokenization error in \'"maven2\' at line 1 column 18')).toBeInTheDocument();
  });

  it('allows new line for expression textarea', async function() {
    const {expression, loadingMask} = renderCreateView();

    await waitForElementToBeRemoved(loadingMask);

    userEvent.type(expression(), 'format == "raw"{enter}and format == "maven2"')

    expect(expression()).toHaveValue('format == "raw"\nand format == "maven2"');
  });

  it('requests confirmation when delete is requested', async function() {
    const itemId = 'test';
    axios.get.mockImplementation((url) => {
      if (url === `/service/rest/v1/security/content-selectors/${itemId}`) {
        return Promise.resolve({
          data: {
            'name' : itemId,
            'type' : 'csel',
            'description' : 'description',
            'expression' : 'format == "raw"'
          }
        });
      }
      else if (url === '/service/rest/internal/ui/repositories?withAll=true&withFormats=true') {
        return Promise.resolve({data: []});
      }
    });

    axios.delete.mockReturnValue(Promise.resolve());

    const {loadingMask, deleteButton} = renderEditView(itemId);

    await waitForElementToBeRemoved(loadingMask);

    axios.put.mockReturnValue(Promise.resolve());

    ExtJS.requestConfirmation.mockReturnValue(CONFIRM);
    userEvent.click(deleteButton());

    await waitFor(() => expect(axios.delete).toBeCalledWith(`/service/rest/v1/security/content-selectors/${itemId}`));
    expect(onDone).toBeCalled();
  });

  it('loads xss and escapes the values', () => {
    axios.get.mockImplementation((url) => {
      if (url === `/service/rest/v1/security/content-selectors/${itemId}`) {
        return Promise.resolve({
          data: {
            'name' : itemId,
            'type' : 'csel',
            'description' : 'description',
            'expression' : 'format == "raw"'
          }
        });
      }
      else if (url === '/service/rest/internal/ui/repositories?withAll=true&withFormats=true') {
        return Promise.resolve({data: []});
      }
    });
  });

  it('saves', async function() {
    axios.get.mockReturnValue(Promise.resolve({data: []}));
    axios.post.mockReturnValue(Promise.resolve());

    const {loadingMask, name, description, expression, saveButton} = renderCreateView();

    await waitForElementToBeRemoved(loadingMask);

    await waitFor(() => expect(window.dirty).toEqual([]));

    await TestUtils.changeField(name, 'test');
    await TestUtils.changeField(description, 'description');
    await TestUtils.changeField(expression, 'format == "raw"');

    await waitFor(() => expect(window.dirty).toEqual(['ContentSelectorsFormMachine']));

    expect(saveButton()).not.toBeDisabled();
    userEvent.click(saveButton());

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
        '/service/rest/v1/security/content-selectors',
        {name: 'test', description: 'description', expression: 'format == "raw"'}
    ));
    expect(window.dirty).toEqual([]);
  });

  describe('ContentSelectorsPreview', function() {
    it('shows previews', async function () {
      const emptyPreviewMessage = UIStrings.CONTENT_SELECTORS.PREVIEW.EMPTY;

      const itemId = 'test';
      axios.get.mockImplementation((url) => {
        if (url === `/service/rest/v1/security/content-selectors/${itemId}`) {
          return Promise.resolve({
            data: {
              'name' : itemId,
              'type' : 'csel',
              'description' : 'description',
              'expression' : 'format == "raw"'
            }
          });
        }
        else if (url === '/service/rest/internal/ui/repositories?withAll=true&withFormats=true') {
          return Promise.resolve({data: [
            {id: "*", name: "(All Repositories)"}
          ]});
        }
      });

      axios.post.mockResolvedValue({data: {
        total: 1,
        results: [{
          id: null,
          repository: 'maven-central',
          format: 'maven2',
          group: 'org.apache.maven',
          name: 'maven-aether-provider',
          version: '3.0',
          assets: null
        }]
      }});

      const {loadingMask, previewButton, getByText} = renderEditView(itemId);
      await waitForElementToBeRemoved(loadingMask);

      expect(getByText(emptyPreviewMessage)).toBeInTheDocument();

      await act(async () => userEvent.click(previewButton()));

      expect(getByText('maven-aether-provider')).toBeInTheDocument();
    });

    it('shows preview error API message', async function () {
      const itemId = 'test';
      axios.get.mockImplementation((url) => {
        if (url === `/service/rest/v1/security/content-selectors/${itemId}`) {
          return Promise.resolve({
            data: {
              'name' : itemId,
              'type' : 'csel',
              'description' : 'description',
              'expression' : 'format == "raw"'
            }
          });
        }
        else if (url === '/service/rest/internal/ui/repositories?withAll=true&withFormats=true') {
          return Promise.resolve({data: [
            {id: "*", name: "(All Repositories)"}
          ]});
        }
      });

      axios.post.mockRejectedValue({
        response: {
          data: [
            {
              id: 'HelperBean.expression',
              message: 'Invalid CSEL'
            }
          ]
        }
      });

      const {loadingMask, previewButton, getByText} = renderEditView(itemId);
      await waitForElementToBeRemoved(loadingMask);

      await act(async () => userEvent.click(previewButton()));

      expect(getByText('An error occurred loading data. Invalid CSEL')).toBeInTheDocument();
    });
  });
});
